import Phaser from 'phaser';
import { CHARACTERS, getCharacter, isPlayable } from '../../data/characters';
import { COLLECTIBLE_IDS, getCollectible } from '../../data/collectibles';
import { getDialogue } from '../../data/dialogue';
import { ENEMIES } from '../../data/enemies';
import { getItem } from '../../data/items';
import { getTechnique } from '../../data/kiTechniques';
import { NPCS } from '../../data/npcs';
import type { ItemDef } from '../../data/types';
import {
  Chest,
  FloorCircle,
  Gate,
  type Interactable,
  Npc,
  Pickup,
} from '../../entities/interactables';
import { type StringKey, t } from '../../i18n';
import { audio } from '../../services/audio';
import { session } from '../../services/session';
import { saveGame } from '../../services/storage';
import {
  type BarrierKind,
  type BarrierRule,
  type BarrierVerdict,
  BOULDER_HITS,
  barrierVerdict,
  boulderDamage,
} from '../../systems/barriers';
import { buyItem, splitMoney } from '../../systems/economy';
import { restoreParty } from '../../systems/gameState';
import { addItem } from '../../systems/inventory';
import { evaluateNpc } from '../../systems/npcRules';
import { PROP_CLEARANCE } from '../../systems/shotBlock';
import type { ActorLook } from '../../ui/actorFrames';
import type { Facing } from '../../ui/humanoid';
import { frameIndex, SHEET_KEYS } from '../../ui/spriteSpec';
import { ensureActorSheet } from '../../ui/textures';
import { facingVector } from '../../utils/direction';
import { sparkBurst } from '../../utils/fx';
import { objectCenter, prop } from '../../utils/tiled';
import type { DialogueLineView } from '../DialogueScene';
import type { WorldScene } from '../WorldScene';

type TiledObject = Phaser.Types.Tilemaps.TiledObject;

interface Transition {
  rect: Phaser.Geom.Rectangle;
  zone: string;
  spawn: string;
  /** The way only opens once this story flag is set (checked live, not at load). */
  requiresFlag?: string;
}

/** `requiresFlag` / `hiddenFlag` props: objects that come and go with the story. */
export function flagsAllow(obj: TiledObject): boolean {
  const requires = prop<string>(obj, 'requiresFlag');
  const hidden = prop<string>(obj, 'hiddenFlag');
  if (requires && !session.state.flags[requires]) return false;
  if (hidden && session.state.flags[hidden]) return false;
  return true;
}
/** Dropped shards vanish after this long (they blink for the last 2 s). */
const MONEY_LIFETIME_MS = 15_000;
/**
 * Builds and runs everything placed in a zone's Tiled object layer besides
 * enemies: chests, gates, NPCs, save/flight circles, pickups and transitions.
 */
export class ZoneContent {
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly npcs: Phaser.Physics.Arcade.Group;
  readonly pickups: Phaser.Physics.Arcade.Group;
  private readonly chests: Chest[] = [];
  private readonly gates: Gate[] = [];
  private readonly circles: FloorCircle[] = [];
  private readonly npcList: Npc[] = [];
  private readonly transitions: Transition[] = [];
  private readonly cutsceneAreas: Array<{ rect: Phaser.Geom.Rectangle; name: string }> = [];
  /** Story changes to the map itself (e.g. the anchor breaking), applied once their flag is set. */
  private tileSwaps: Array<{ obj: TiledObject; flag: string; gid: number }> = [];
  private readonly npcByName = new Map<string, Npc>();
  private readonly prompt: Phaser.GameObjects.BitmapText;
  private transitioning = false;

  constructor(private readonly world: WorldScene) {
    this.solids = world.physics.add.staticGroup();
    this.npcs = world.physics.add.group({ runChildUpdate: true });
    this.pickups = world.physics.add.group();
    this.prompt = world.add
      .bitmapText(0, 0, 'pxs', '!')
      .setOrigin(0.5, 1)
      .setTint(0xffd34a)
      .setDepth(200_000)
      .setVisible(false);
  }

  private get zoneId(): string {
    return this.world.zoneId;
  }

  private key(obj: TiledObject): string {
    return `${this.zoneId}:${obj.name || obj.id}`;
  }

  build(objects: TiledObject[]): void {
    for (const obj of objects) {
      switch (obj.type) {
        case 'chest':
          this.addChest(obj);
          break;
        case 'gate':
          this.addGate(obj);
          break;
        case 'npc':
          this.addNpc(obj);
          break;
        case 'saveCircle':
        case 'flightCircle': {
          const c = objectCenter(obj);
          this.circles.push(
            new FloorCircle(this.world, c.x, c.y, obj.type === 'saveCircle' ? 'save' : 'flight'),
          );
          break;
        }
        case 'collectible':
          this.addCollectible(obj);
          break;
        case 'tileSwap': {
          const flag = prop<string>(obj, 'flag');
          const gid = prop<number>(obj, 'gid');
          if (flag && gid) this.tileSwaps.push({ obj, flag, gid });
          break;
        }
        case 'cutscene':
          this.cutsceneAreas.push({
            rect: new Phaser.Geom.Rectangle(
              obj.x ?? 0,
              obj.y ?? 0,
              obj.width ?? 16,
              obj.height ?? 16,
            ),
            name: obj.name,
          });
          break;
        case 'transition':
          this.transitions.push({
            rect: new Phaser.Geom.Rectangle(
              obj.x ?? 0,
              obj.y ?? 0,
              obj.width ?? 16,
              obj.height ?? 16,
            ),
            zone: prop<string>(obj, 'targetZone', ''),
            spawn: prop<string>(obj, 'targetSpawn', ''),
            requiresFlag: prop<string>(obj, 'requiresFlag'),
          });
          break;
        default:
          break;
      }
    }
    const player = this.world.player;
    this.world.physics.add.collider(player, this.solids);
    this.world.physics.add.collider(player, this.npcs);
    this.world.physics.add.collider(this.world.enemies, this.solids);
    this.world.physics.add.overlap(player, this.pickups, (_p, obj) => this.collect(obj as Pickup));
  }

  /**
   * A closed gate, a boulder or a seal stands at (x, y) and stops blasts; a chest is waist-high,
   * so blasts fired in flight clear it.
   */
  blocksShot(x: number, y: number, lift: number): boolean {
    for (const obj of this.solids.getChildren()) {
      const body = (obj as Phaser.GameObjects.Zone).body as Phaser.Physics.Arcade.StaticBody | null;
      if (!body?.enable || obj.getData('low')) continue;
      if (obj instanceof Chest && lift >= PROP_CLEARANCE) continue;
      if (x >= body.x && x < body.right && y >= body.y && y < body.bottom) return true;
    }
    return false;
  }

  private addChest(obj: TiledObject): void {
    const c = objectCenter(obj);
    const key = this.key(obj);
    const chest = new Chest(
      this.world,
      c.x,
      c.y + 8,
      key,
      prop<string>(obj, 'itemId'),
      prop<string>(obj, 'collectibleId'),
      prop<string>(obj, 'hiddenUntilGroupCleared'),
    );
    this.solids.add(chest);
    chest.fitBody();
    chest.setOpened(session.state.openedChests.includes(key));
    const group = chest.hiddenGroup;
    if (group && !session.state.clearedGroups.includes(`${this.zoneId}:${group}`))
      chest.setHidden(true);
    this.chests.push(chest);
  }

  private addGate(obj: TiledObject): void {
    const key = this.key(obj);
    const rect = new Phaser.Geom.Rectangle(
      obj.x ?? 0,
      obj.y ?? 0,
      obj.width ?? 16,
      obj.height ?? 16,
    );
    const kind = prop<BarrierKind>(obj, 'kind', 'level');
    const rule: BarrierRule = {
      kind,
      character: prop<string>(obj, 'requiredCharacter', kind === 'boulder' ? 'okun' : 'tavi'),
      level: prop<number>(obj, 'requiredLevel', 1),
      openFlag: prop<string>(obj, 'openFlag'),
    };
    const hint = prop<string>(obj, 'hintKey') as StringKey | undefined;
    const gate = new Gate(this.world, rect, key, rule, hint);
    this.solids.add(gate.zone);
    // Vents and crawlholes are low openings: blasts fly over them.
    gate.zone.setData('low', kind === 'vent' || kind === 'crawl');
    const open =
      session.state.brokenGates.includes(key) ||
      (kind === 'seal' && barrierVerdict(rule, session.state) === 'open');
    if (open) gate.shatter(false);
    this.gates.push(gate);
  }

  private addNpc(obj: TiledObject): void {
    const npcId = prop<string>(obj, 'npcId');
    if (!npcId) return;
    // A party member being played isn't also standing around as an NPC.
    if (npcId === session.state.activeCharacter) return;
    if (!flagsAllow(obj)) return;
    const c = objectCenter(obj);
    const npc = new Npc(this.world, c.x, c.y, npcId, prop<Facing>(obj, 'facing', 'down'));
    this.npcByName.set(obj.name, npc);
    this.npcs.add(npc);
    npc.initBody();
    this.npcList.push(npc);
  }

  private addCollectible(obj: TiledObject): void {
    const id = prop<string>(obj, 'collectibleId');
    if (!id || session.state.collectiblesFound.includes(id)) return;
    const c = objectCenter(obj);
    this.pickups.add(new Pickup(this.world, c.x, c.y, 'collectible', id));
  }

  dropItem(x: number, y: number, itemId: string): void {
    this.pickups.add(new Pickup(this.world, x, y, 'item', itemId));
  }

  /** Scatters anchor shards around a fallen enemy; they fade if left lying too long. */
  dropMoney(x: number, y: number, total: number): void {
    const pieces = splitMoney(total);
    pieces.forEach((amount, i) => {
      const a = (i / pieces.length) * Math.PI * 2 + Math.random() * 0.6;
      const r = pieces.length > 1 ? 8 + Math.random() * 8 : 0;
      const shard = new Pickup(
        this.world,
        Math.round(x + Math.cos(a) * r),
        Math.round(y + Math.sin(a) * r * 0.7),
        'money',
        'money',
        undefined,
        amount,
      );
      shard.setScale(0);
      this.world.tweens.add({ targets: shard, scale: 1, duration: 200, ease: 'Back.easeOut' });
      this.pickups.add(shard);
      this.world.time.delayedCall(MONEY_LIFETIME_MS - 2000, () => {
        if (!shard.active) return;
        this.world.tweens.add({ targets: shard, alpha: 0.2, yoyo: true, repeat: 9, duration: 100 });
      });
      this.world.time.delayedCall(MONEY_LIFETIME_MS, () => {
        if (shard.active) shard.destroy();
      });
    });
  }

  /** Reveals chests waiting for a cleared enemy group. */
  onGroupCleared(group: string): void {
    for (const chest of this.chests) {
      if (chest.hiddenGroup !== group || !chest.hidden) continue;
      chest.setHidden(false);
      chest.setAlpha(0);
      this.world.tweens.add({ targets: chest, alpha: 1, duration: 500 });
      sparkBurst(this.world, chest.x, chest.y - 6, 0xffe080, 14);
      this.world.toast(t('ui.somethingAppeared'));
    }
  }

  // --- Interaction ---------------------------------------------------------

  private candidates(forAttack: boolean): Interactable[] {
    // The attack button punches boulders instead of asking about them.
    const gates = forAttack ? this.gates.filter((g) => g.kind !== 'boulder') : this.gates;
    // Cutscenes can despawn map NPCs (rescued workers walk off), so skip destroyed ones.
    const npcs = this.npcList.filter((n) => n.active);
    return [...this.chests, ...gates, ...this.circles, ...npcs].filter((i) => i.enabled());
  }

  /** Interactable in front of (or under, for floor circles) the player. */
  target(forAttack = false): Interactable | null {
    const p = this.world.player;
    // Chests, NPCs and circles need you on the ground.
    if (p.flying) return null;
    const f = facingVector(p.facing);
    const fx = p.footX + f.x * 10;
    const fy = p.footY + f.y * 10;
    let best: Interactable | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const it of this.candidates(forAttack)) {
      let d: number;
      if (it.onFloor) {
        d = Phaser.Math.Distance.Between(p.footX, p.footY, it.ix, it.iy);
      } else if (it instanceof Gate) {
        const n = it.nearestPoint(fx, fy);
        d = Phaser.Math.Distance.Between(fx, fy, n.x, n.y) + 4;
        if (d > 12) continue;
        d = 0;
      } else {
        d = Phaser.Math.Distance.Between(fx, fy, it.ix, it.iy);
      }
      if (d <= it.radius && d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    return best;
  }

  interact(target: Interactable): void {
    if (target instanceof Chest) this.openChest(target);
    else if (target instanceof Gate) this.tryBreakGate(target);
    else if (target instanceof Npc) this.talk(target);
    else if (target instanceof FloorCircle) {
      if (target.kind === 'save') this.promptSave();
      else this.promptFlight();
    }
  }

  private openChest(chest: Chest): void {
    audio.play('chest');
    chest.setOpened(true);
    session.state.openedChests = [...session.state.openedChests, chest.key];
    sparkBurst(this.world, chest.x, chest.y - 10, 0xffe080, 8);
    if (chest.collectibleId) this.giveCollectible(chest.collectibleId);
    if (chest.itemId) this.giveItem(chest.itemId);
    this.world.player.showOff(chest.collectibleId ? 'collectible' : 'item-drop');
  }

  private giveItem(itemId: string): void {
    session.state.inventory = addItem(session.state.inventory, itemId);
    this.world.toast(t('ui.obtained', { name: t(getItem(itemId).nameKey) }));
  }

  /** Shop menu: pick an item, read what it does, buy it; loops until the player leaves. */
  private openShop(npc: Npc, stock: readonly string[]): void {
    const items = stock.map(getItem);
    this.world.runDialogue({
      lines: this.lines('odaShop').map((l) => ({ ...l, speaker: t(npc.def.nameKey) })),
      choices: [
        ...items.map((it) => t('shop.entry', { name: t(it.nameKey), price: it.price ?? 0 })),
        t('shop.leave'),
      ],
      onDone: (choice) => {
        const item = items[choice];
        if (item) this.world.time.delayedCall(50, () => this.offer(npc, stock, item));
      },
    });
  }

  private offer(npc: Npc, stock: readonly string[], item: ItemDef): void {
    const info = item.equip
      ? `\n${t('ui.equipInfo', { slot: t(`slot.${item.equip.slot}`), level: item.equip.minLevel })}`
      : '';
    this.world.runDialogue({
      lines: [{ speaker: t(item.nameKey), text: `${t(item.descKey)}${info}` }],
      choices: [t('shop.buy', { price: item.price ?? 0 }), t('ui.no')],
      onDone: (choice) => {
        if (choice === 0) {
          const r = buyItem(session.state, item.id);
          if (r.result === 'ok') {
            session.state = r.state;
            audio.play('pickup');
            this.world.toast(t('shop.bought', { name: t(item.nameKey) }));
          } else this.world.toast(t('shop.tooPoor'));
        }
        this.world.time.delayedCall(50, () => this.openShop(npc, stock));
      },
    });
  }

  private giveCollectible(id: string): void {
    if (!session.state.collectiblesFound.includes(id)) {
      session.state.collectiblesFound = [...session.state.collectiblesFound, id];
    }
    this.world.toast(t('ui.obtainedCollectible', { name: t(getCollectible(id).nameKey) }));
  }

  private collect(pickup: Pickup): void {
    if (!pickup.active) return;
    audio.play('pickup');
    const color = { collectible: 0xffd34a, item: 0x8cf08c, money: 0x9ff6ff }[pickup.kind];
    sparkBurst(this.world, pickup.x, pickup.y, color, pickup.kind === 'money' ? 4 : 8);
    if (pickup.kind === 'money') {
      session.state.money += pickup.amount;
      this.world.floatText(
        pickup.x,
        pickup.y - 8,
        t('hud.money', { amount: pickup.amount }),
        'money',
      );
    } else if (pickup.kind === 'collectible') this.giveCollectible(pickup.id);
    else this.giveItem(pickup.id);
    pickup.destroy();
  }

  private tryBreakGate(gate: Gate): void {
    const verdict = barrierVerdict(gate.rule, session.state);
    if (gate.kind === 'seal') {
      this.world.toast(t(gate.hintKey ?? 'ui.sealClosed'));
      return;
    }
    if (gate.kind === 'boulder') {
      // Boulders open by punching; using them only explains what they need.
      this.world.toast(this.boulderHint(gate, verdict));
      return;
    }
    if (verdict !== 'open') {
      const { character, level } = gate.rule;
      const name = t(getCharacter(character).nameKey);
      // Before the right member joins, field abilities only hint at what it takes.
      if (gate.kind !== 'level' && !isPlayable(character, session.state.flags)) {
        this.world.toast(t(gate.kind === 'vent' ? 'ui.ventUnknown' : 'ui.crawlUnknown'));
        return;
      }
      const current = session.state.party[character]?.level ?? 1;
      const key: StringKey =
        verdict === 'lowLevel'
          ? 'ui.gateLowLevel'
          : isPlayable(character, session.state.flags)
            ? 'ui.gateSwitch'
            : 'ui.gateLocked';
      this.world.toast(t(key, { name, level, current }));
      this.world.cameras.main.shake(80, 0.002);
      return;
    }
    const message: StringKey =
      gate.kind === 'vent'
        ? 'ui.ventOpened'
        : gate.kind === 'crawl'
          ? 'ui.crawlOpened'
          : 'ui.gateBroken';
    if (gate.kind === 'vent' || gate.kind === 'crawl') this.world.player.holdPose('cast', 400);
    this.breakGate(gate, message);
  }

  private breakGate(gate: Gate, messageKey: StringKey): void {
    audio.play('gate');
    gate.shatter(true);
    if (gate.kind !== 'seal') session.state.brokenGates = [...session.state.brokenGates, gate.key];
    this.world.cameras.main.shake(160, 0.006);
    const color =
      gate.kind === 'boulder' || gate.kind === 'seal'
        ? 0xd8c8a0
        : getCharacter(gate.rule.character).color;
    sparkBurst(this.world, gate.ix, gate.iy, color, 16);
    this.world.toast(t(messageKey));
  }

  private boulderHint(gate: Gate, verdict: BarrierVerdict): string {
    const char = getCharacter(gate.rule.character);
    // Before he joins, nobody knows whose strength it takes.
    if (!isPlayable(char.id, session.state.flags)) return t('ui.boulderUnknown');
    if (verdict === 'lowLevel')
      return t('ui.gateLocked', { name: t(char.nameKey), level: gate.rule.level });
    return t('ui.boulderNeeds', { name: t(char.nameKey) });
  }

  private lastClangAt = 0;

  /** A melee swing reached `rect`: boulders crack under the right fists and ring otherwise. */
  strike(rect: Phaser.Geom.Rectangle, finisher: boolean): void {
    for (const gate of this.gates) {
      if (gate.broken || gate.kind !== 'boulder') continue;
      if (!Phaser.Geom.Rectangle.Overlaps(rect, gate.rect)) continue;
      const verdict = barrierVerdict(gate.rule, session.state);
      if (verdict !== 'open') {
        audio.play('block');
        const p = gate.nearestPoint(this.world.player.footX, this.world.player.footY);
        sparkBurst(this.world, p.x, p.y, 0xc8c8d0, 4);
        if (this.world.time.now - this.lastClangAt > 1500)
          this.world.toast(this.boulderHint(gate, verdict));
        this.lastClangAt = this.world.time.now;
        continue;
      }
      gate.hits += boulderDamage(finisher);
      if (gate.hits >= BOULDER_HITS) {
        this.breakGate(gate, 'ui.boulderBroken');
        continue;
      }
      audio.play('hit');
      gate.crack();
      this.world.cameras.main.shake(70, 0.003);
      sparkBurst(this.world, gate.ix, gate.iy, 0xd8c8a0, 6);
    }
  }

  /** Seals open by themselves when their story flag is set (e.g. by a dialogue). */
  private checkSeals(): void {
    for (const gate of this.gates) {
      if (gate.broken || gate.kind !== 'seal') continue;
      if (barrierVerdict(gate.rule, session.state) === 'open')
        this.breakGate(gate, 'ui.sealOpened');
    }
  }

  private checkTileSwaps(): void {
    if (!this.tileSwaps.some((sw) => session.state.flags[sw.flag])) return;
    for (const sw of this.tileSwaps) {
      if (!session.state.flags[sw.flag]) continue;
      const { obj, gid } = sw;
      this.world.swapTiles(obj.x ?? 0, obj.y ?? 0, obj.width ?? 16, obj.height ?? 16, gid);
      const c = objectCenter(obj);
      sparkBurst(this.world, c.x, c.y, 0x9ff6ff, 14);
    }
    this.tileSwaps = this.tileSwaps.filter((sw) => !session.state.flags[sw.flag]);
  }

  private dialogueParams(): Record<string, string | number> {
    return {
      delivered: session.state.collectiblesDelivered.length,
      total: COLLECTIBLE_IDS.length,
      player: t(getCharacter(session.state.activeCharacter).nameKey),
      money: session.state.money,
    };
  }

  /** Converts a dialogue script into display lines with placeholders resolved. */
  lines(dialogueId: string): DialogueLineView[] {
    const params = this.dialogueParams();
    return getDialogue(dialogueId).lines.map((l) => ({
      speaker: t(l.speaker),
      text: t(l.text, params),
      portrait: this.portrait(l.speaker),
    }));
  }

  /** The speaker's sprite sheet (idle, facing down) for the dialogue box portrait. */
  private portrait(speaker: StringKey): DialogueLineView['portrait'] {
    const char = Object.values(CHARACTERS).find((c) => c.nameKey === speaker);
    const npc = Object.values(NPCS).find((n) => n.nameKey === speaker);
    const enemy = Object.values(ENEMIES).find((e) => e.nameKey === speaker);
    const found = char
      ? { key: SHEET_KEYS.character(char.id), look: char.look }
      : npc
        ? { key: SHEET_KEYS.npc(npc.id), look: npc.look }
        : enemy
          ? { key: SHEET_KEYS.enemy(enemy.id), look: enemy.look }
          : transformedBoss(speaker);
    if (!found) return undefined;
    ensureActorSheet(this.world, found.key, found.look);
    return { key: found.key, frame: frameIndex('down', 'idle') };
  }

  private talk(npc: Npc): void {
    npc.faceToward(this.world.player.footX, this.world.player.footY);
    npc.holdPose('idle', 0);
    const outcome = evaluateNpc(npc.def.rules, session.state, { allCollectibles: COLLECTIBLE_IDS });
    if (!outcome) return;
    const learned = outcome.applied.flatMap((e) => (e.learnTechnique ? [e.learnTechnique] : []));
    const items = outcome.applied.flatMap((e) => (e.giveItem ? [e.giveItem] : []));
    session.state = outcome.state;
    // Lines are built after applying effects so counters (delivered/total) are current.
    this.world.runDialogue({
      lines: this.lines(outcome.dialogue),
      onDone: () => {
        for (const id of learned)
          this.world.toast(t('ui.learned', { name: t(getTechnique(id).nameKey) }));
        for (const id of items)
          this.world.toast(t('ui.obtained', { name: t(getItem(id).nameKey) }));
        if (items.length > 0) this.world.player.showOff('item-drop');
        if (outcome.chain) this.world.time.delayedCall(50, () => this.talk(npc));
        else if (npc.def.shop) {
          const stock = npc.def.shop;
          this.world.time.delayedCall(50, () => this.openShop(npc, stock));
        }
      },
    });
  }

  private promptSave(): void {
    this.world.runDialogue({
      lines: [{ text: t('ui.savePrompt') }],
      choices: [t('ui.yes'), t('ui.no')],
      onDone: (choice) => {
        if (choice !== 0) return;
        const p = this.world.player;
        session.state = restoreParty(session.state);
        session.state.location = { zone: this.zoneId, x: Math.round(p.x), y: Math.round(p.y) };
        const ok = saveGame(session.state);
        if (ok) audio.play('save');
        this.world.toast(ok ? t('ui.saved') : t('ui.saveFailed'));
      },
    });
  }

  private promptFlight(): void {
    this.world.openWorldMap();
  }

  npcNamed(name: string): Npc | null {
    return this.npcByName.get(name) ?? null;
  }

  /** Shows a "!" above the current target and checks zone transitions and cutscene areas. */
  update(): void {
    this.checkSeals();
    this.checkTileSwaps();
    if (this.world.cinematic) {
      this.prompt.setVisible(false);
      return;
    }
    const p = this.world.player;
    const area = this.cutsceneAreas.find((a) => a.rect.contains(p.footX, p.footY));
    if (area && this.world.cutscenes.tryPlay({ on: 'area', area: area.name })) return;
    const target = this.world.player.isDowned ? null : this.target();
    if (target) {
      const y =
        target instanceof Npc
          ? target.y - 14
          : target instanceof Gate
            ? target.top - 16
            : target.iy - 10;
      this.prompt
        .setPosition(Math.round(target.ix), Math.round(y + Math.sin(this.world.time.now / 150)))
        .setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
    this.checkTransitions();
  }

  private checkTransitions(): void {
    // No running from a boss: the way out stays shut until the fight is over.
    const boss = this.world.activeBoss;
    if (this.transitioning || (boss?.active && !boss.isDead)) return;
    const p = this.world.player;
    for (const tr of this.transitions) {
      if (tr.requiresFlag && !session.state.flags[tr.requiresFlag]) continue;
      if (tr.rect.contains(p.footX, p.footY)) {
        this.transitioning = true;
        this.world.changeZone(tr.zone, tr.spawn, false);
        return;
      }
    }
  }
}

/** A boss speaking under its transformed name (BossPhase.nameKey) shows that form's face. */
function transformedBoss(speaker: StringKey): { key: string; look: ActorLook } | null {
  for (const e of Object.values(ENEMIES)) {
    const i = e.phases?.findIndex((p) => p.nameKey === speaker && p.look) ?? -1;
    const look = e.phases?.[i]?.look;
    if (look) return { key: SHEET_KEYS.enemy(e.id, i), look };
  }
  return null;
}
