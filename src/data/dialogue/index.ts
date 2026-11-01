import type { DialogueDef } from '../types';

/**
 * Dialogue scripts. Text lives in i18n/es.ts; lines may use {delivered}, {total}
 * and {player} placeholders filled in by the world.
 */
const d = (id: string, lines: DialogueDef['lines']): DialogueDef => ({ id, lines });

export const DIALOGUES: Record<string, DialogueDef> = {
  ioleIntro: d('ioleIntro', [
    { speaker: 'npc.iole', text: 'dlg.ioleIntro.1' },
    { speaker: 'char.tavi', text: 'dlg.ioleIntro.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleIntro.3' },
    { speaker: 'npc.iole', text: 'dlg.ioleIntro.4' },
    { speaker: 'char.tavi', text: 'dlg.ioleIntro.5' },
    { speaker: 'npc.iole', text: 'dlg.ioleIntro.6' },
  ]),
  openingQuake: d('openingQuake', [{ speaker: 'char.tavi', text: 'dlg.openingQuake.1' }]),
  openingNilo: d('openingNilo', [
    { speaker: 'npc.nilo', text: 'dlg.openingNilo.1' },
    { speaker: 'char.tavi', text: 'dlg.openingNilo.2' },
    { speaker: 'npc.nilo', text: 'dlg.openingNilo.3' },
  ]),
  ioleRemind: d('ioleRemind', [{ speaker: 'npc.iole', text: 'dlg.ioleRemind.1' }]),
  ioleReport: d('ioleReport', [
    { speaker: 'npc.iole', text: 'dlg.ioleReport.1' },
    { speaker: 'char.tavi', text: 'dlg.ioleReport.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleReport.3' },
    { speaker: 'npc.iole', text: 'dlg.ioleReport.4' },
  ]),
  ioleAfter: d('ioleAfter', [{ speaker: 'npc.iole', text: 'dlg.ioleAfter.1' }]),
  ioleOkun: d('ioleOkun', [
    { speaker: 'npc.iole', text: 'dlg.ioleOkun.1' },
    { speaker: 'char.okun', text: 'dlg.ioleOkun.2' },
    { speaker: 'char.tavi', text: 'dlg.ioleOkun.3' },
    { speaker: 'npc.iole', text: 'dlg.ioleOkun.4' },
  ]),
  ioleSarn: d('ioleSarn', [{ speaker: 'npc.iole', text: 'dlg.ioleSarn.1' }]),
  niloOkun: d('niloOkun', [{ speaker: 'npc.nilo', text: 'dlg.niloOkun.1' }]),
  cobreArrive: d('cobreArrive', [{ speaker: 'char.tavi', text: 'dlg.cobreArrive.1' }]),
  cobreWitness: d('cobreWitness', [
    { speaker: 'char.tavi', text: 'dlg.cobreWitness.1' },
    { speaker: 'char.tavi', text: 'dlg.cobreWitness.2' },
  ]),
  okunDuel: d('okunDuel', [
    { speaker: 'char.okun', text: 'dlg.okunDuel.1' },
    { speaker: 'char.tavi', text: 'dlg.okunDuel.2' },
    { speaker: 'char.okun', text: 'dlg.okunDuel.3' },
  ]),
  okunPhase2: d('okunPhase2', [{ speaker: 'char.okun', text: 'dlg.okunPhase2.1' }]),
  okunYield: d('okunYield', [
    { speaker: 'char.okun', text: 'dlg.okunYield.1' },
    { speaker: 'char.tavi', text: 'dlg.okunYield.2' },
    { speaker: 'char.okun', text: 'dlg.okunYield.3' },
  ]),
  sarnTaunt: d('sarnTaunt', [
    { speaker: 'enemy.sarn', text: 'dlg.sarnTaunt.1' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnTaunt.2' },
    { speaker: 'char.okun', text: 'dlg.sarnTaunt.3' },
  ]),
  okunJoin: d('okunJoin', [
    { speaker: 'char.okun', text: 'dlg.okunJoin.1' },
    { speaker: 'char.tavi', text: 'dlg.okunJoin.2' },
  ]),

  sarnArrive: d('sarnArrive', [
    { speaker: 'char.tavi', text: 'dlg.sarnArrive.1' },
    { speaker: 'char.okun', text: 'dlg.sarnArrive.2' },
  ]),
  sarnAnchor: d('sarnAnchor', [
    { speaker: 'enemy.sarn', text: 'dlg.sarnAnchor.1' },
    { speaker: 'char.okun', text: 'dlg.sarnAnchor.2' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnAnchor.3' },
    { speaker: 'char.tavi', text: 'dlg.sarnAnchor.4' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnAnchor.5' },
    { speaker: 'char.okun', text: 'dlg.sarnAnchor.6' },
  ]),
  sarnCornered: d('sarnCornered', [
    { speaker: 'enemy.sarn', text: 'dlg.sarnCornered.1' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnCornered.2' },
  ]),
  sarnTransformed: d('sarnTransformed', [
    { speaker: 'enemy.sarnCrystal', text: 'dlg.sarnTransformed.1' },
    { speaker: 'char.tavi', text: 'dlg.sarnTransformed.2' },
  ]),
  sarnDesperate: d('sarnDesperate', [
    { speaker: 'enemy.sarnCrystal', text: 'dlg.sarnDesperate.1' },
  ]),
  sarnFalls: d('sarnFalls', [{ speaker: 'enemy.sarn', text: 'dlg.sarnFalls.1' }]),
  anchorBreaks: d('anchorBreaks', [
    { speaker: 'char.tavi', text: 'dlg.anchorBreaks.1' },
    { speaker: 'char.okun', text: 'dlg.anchorBreaks.2' },
    { speaker: 'char.tavi', text: 'dlg.anchorBreaks.3' },
  ]),
  sarnFlees: d('sarnFlees', [
    { speaker: 'enemy.sarn', text: 'dlg.sarnFlees.1' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnFlees.2' },
  ]),
  afterSarn: d('afterSarn', [
    { speaker: 'char.okun', text: 'dlg.afterSarn.1' },
    { speaker: 'char.tavi', text: 'dlg.afterSarn.2' },
  ]),
  ioleVault1: d('ioleVault1', [
    { speaker: 'npc.iole', text: 'dlg.ioleVault1.1' },
    { speaker: 'char.tavi', text: 'dlg.ioleVault1.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleVault1.3' },
  ]),
  ioleVault2: d('ioleVault2', [
    { speaker: 'npc.iole', text: 'dlg.ioleVault2.1' },
    { speaker: 'npc.iole', text: 'dlg.ioleVault2.2' },
  ]),
  ioleVault3: d('ioleVault3', [
    { speaker: 'npc.iole', text: 'dlg.ioleVault3.1' },
    { speaker: 'npc.iole', text: 'dlg.ioleVault3.2' },
    { speaker: 'char.okun', text: 'dlg.ioleVault3.3' },
  ]),
  ioleArc1End: d('ioleArc1End', [{ speaker: 'npc.iole', text: 'dlg.ioleArc1End.1' }]),
  niloAnchor: d('niloAnchor', [{ speaker: 'npc.nilo', text: 'dlg.niloAnchor.1' }]),

  pimIntro: d('pimIntro', [
    { speaker: 'npc.pim', text: 'dlg.pimIntro.1' },
    { speaker: 'npc.pim', text: 'dlg.pimIntro.2' },
  ]),
  pimIdle: d('pimIdle', [{ speaker: 'npc.pim', text: 'dlg.pimIdle.1' }]),
  pimDeliver: d('pimDeliver', [{ speaker: 'npc.pim', text: 'dlg.pimDeliver.1' }]),
  pimReward: d('pimReward', [
    { speaker: 'npc.pim', text: 'dlg.pimReward.1' },
    { speaker: 'npc.pim', text: 'dlg.pimReward.2' },
  ]),
  pimThanks: d('pimThanks', [{ speaker: 'npc.pim', text: 'dlg.pimThanks.1' }]),

  odaHello: d('odaHello', [{ speaker: 'npc.oda', text: 'dlg.odaHello.1' }]),
  odaShop: d('odaShop', [{ speaker: 'npc.oda', text: 'dlg.odaShop.1' }]),
  niloTip: d('niloTip', [
    { speaker: 'npc.nilo', text: 'dlg.niloTip.1' },
    { speaker: 'npc.nilo', text: 'dlg.niloTip.2' },
  ]),
  niloAfter: d('niloAfter', [{ speaker: 'npc.nilo', text: 'dlg.niloAfter.1' }]),

  bossIntro: d('bossIntro', [
    { speaker: 'enemy.grell', text: 'dlg.bossIntro.1' },
    { speaker: 'char.tavi', text: 'dlg.bossIntro.2' },
    { speaker: 'enemy.grell', text: 'dlg.bossIntro.3' },
  ]),
  bossPhase2: d('bossPhase2', [{ speaker: 'enemy.grell', text: 'dlg.bossPhase2.1' }]),
  bossDefeated: d('bossDefeated', [
    { speaker: 'enemy.grell', text: 'dlg.bossDefeated.1' },
    { speaker: 'char.tavi', text: 'dlg.bossDefeated.2' },
  ]),

  // --- Arc 2, chapter 4: Marismas de Sal ----------------------------------------------------
  ioleMarshBrief: d('ioleMarshBrief', [
    { speaker: 'npc.iole', text: 'dlg.ioleMarshBrief.1' },
    { speaker: 'npc.iole', text: 'dlg.ioleMarshBrief.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleMarshBrief.3' },
    { speaker: 'char.okun', text: 'dlg.ioleMarshBrief.4' },
  ]),
  ioleMarshRemind: d('ioleMarshRemind', [{ speaker: 'npc.iole', text: 'dlg.ioleMarshRemind.1' }]),
  marshArrive: d('marshArrive', [
    { speaker: 'char.tavi', text: 'dlg.marshArrive.1' },
    { speaker: 'char.okun', text: 'dlg.marshArrive.2' },
    { speaker: 'char.tavi', text: 'dlg.marshArrive.3' },
  ]),
  breaAsk: d('breaAsk', [
    { speaker: 'npc.brea', text: 'dlg.breaAsk.1' },
    { speaker: 'npc.brea', text: 'dlg.breaAsk.2' },
    { speaker: 'npc.brea', text: 'dlg.breaAsk.3' },
  ]),
  breaAllHome: d('breaAllHome', [
    { speaker: 'npc.brea', text: 'dlg.breaAllHome.1' },
    { speaker: 'npc.brea', text: 'dlg.breaAllHome.2' },
    { speaker: 'npc.brea', text: 'dlg.breaAllHome.3' },
  ]),
  breaAnchor: d('breaAnchor', [{ speaker: 'npc.brea', text: 'dlg.breaAnchor.1' }]),
  breaAfter: d('breaAfter', [
    { speaker: 'npc.brea', text: 'dlg.breaAfter.1' },
    { speaker: 'npc.brea', text: 'dlg.breaAfter.2' },
  ]),
  ruyFound: d('ruyFound', [
    { speaker: 'npc.ruy', text: 'dlg.ruyFound.1' },
    { speaker: 'char.tavi', text: 'dlg.ruyFound.2' },
  ]),
  ruyHome: d('ruyHome', [{ speaker: 'npc.ruy', text: 'dlg.ruyHome.1' }]),
  melaFound: d('melaFound', [
    { speaker: 'npc.mela', text: 'dlg.melaFound.1' },
    { speaker: 'char.okun', text: 'dlg.melaFound.2' },
  ]),
  melaHome: d('melaHome', [{ speaker: 'npc.mela', text: 'dlg.melaHome.1' }]),
  tobiFound: d('tobiFound', [
    { speaker: 'npc.tobi', text: 'dlg.tobiFound.1' },
    { speaker: 'char.okun', text: 'dlg.tobiFound.2' },
  ]),
  tobiHome: d('tobiHome', [{ speaker: 'npc.tobi', text: 'dlg.tobiHome.1' }]),
  damasoAsk: d('damasoAsk', [{ speaker: 'npc.damaso', text: 'dlg.damasoAsk.1' }]),
  damasoPay: d('damasoPay', [{ speaker: 'npc.damaso', text: 'dlg.damasoPay.1' }]),
  damasoThanks: d('damasoThanks', [{ speaker: 'npc.damaso', text: 'dlg.damasoThanks.1' }]),
  veskMeet: d('veskMeet', [
    { speaker: 'enemy.vesk', text: 'dlg.veskMeet.1' },
    { speaker: 'char.tavi', text: 'dlg.veskMeet.2' },
    { speaker: 'enemy.vesk', text: 'dlg.veskMeet.3' },
    { speaker: 'enemy.vesk', text: 'dlg.veskMeet.4' },
  ]),
  ioleRiftBrief: d('ioleRiftBrief', [
    { speaker: 'npc.iole', text: 'dlg.ioleRiftBrief.1' },
    { speaker: 'npc.iole', text: 'dlg.ioleRiftBrief.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleRiftBrief.3' },
    { speaker: 'char.tavi', text: 'dlg.ioleRiftBrief.4' },
  ]),
  colossusLast: d('colossusLast', [{ speaker: 'char.okun', text: 'dlg.colossusLast.1' }]),
  marshSaved: d('marshSaved', [
    { speaker: 'char.tavi', text: 'dlg.marshSaved.1' },
    { speaker: 'char.okun', text: 'dlg.marshSaved.2' },
    { speaker: 'enemy.vesk', text: 'dlg.marshSaved.3' },
    { speaker: 'enemy.vesk', text: 'dlg.marshSaved.4' },
    { speaker: 'char.okun', text: 'dlg.marshSaved.5' },
    { speaker: 'char.tavi', text: 'dlg.marshSaved.6' },
  ]),
  ioleRiftRemind: d('ioleRiftRemind', [{ speaker: 'npc.iole', text: 'dlg.ioleRiftRemind.1' }]),
  riftArrive: d('riftArrive', [
    { speaker: 'char.okun', text: 'dlg.riftArrive.1' },
    { speaker: 'char.tavi', text: 'dlg.riftArrive.2' },
    { speaker: 'char.okun', text: 'dlg.riftArrive.3' },
    { speaker: 'char.tavi', text: 'dlg.riftArrive.4' },
  ]),
  toloAsk: d('toloAsk', [
    { speaker: 'npc.tolo', text: 'dlg.toloAsk.1' },
    { speaker: 'npc.tolo', text: 'dlg.toloAsk.2' },
    { speaker: 'npc.tolo', text: 'dlg.toloAsk.3' },
  ]),
  toloRemind: d('toloRemind', [{ speaker: 'npc.tolo', text: 'dlg.toloRemind.1' }]),
  toloPay: d('toloPay', [
    { speaker: 'npc.tolo', text: 'dlg.toloPay.1' },
    { speaker: 'npc.tolo', text: 'dlg.toloPay.2' },
  ]),
  toloThanks: d('toloThanks', [{ speaker: 'npc.tolo', text: 'dlg.toloThanks.1' }]),
  grellReturn: d('grellReturn', [
    { speaker: 'enemy.grell', text: 'dlg.grellReturn.1' },
    { speaker: 'char.tavi', text: 'dlg.grellReturn.2' },
    { speaker: 'enemy.grell', text: 'dlg.grellReturn.3' },
    { speaker: 'enemy.grell', text: 'dlg.grellReturn.4' },
  ]),
  grellRage: d('grellRage', [{ speaker: 'enemy.grell', text: 'dlg.grellRage.1' }]),
  grellBeaten: d('grellBeaten', [
    { speaker: 'enemy.grell', text: 'dlg.grellBeaten.1' },
    { speaker: 'char.okun', text: 'dlg.grellBeaten.2' },
    { speaker: 'enemy.grell', text: 'dlg.grellBeaten.3' },
    { speaker: 'enemy.grell', text: 'dlg.grellBeaten.4' },
  ]),
  veskRift: d('veskRift', [
    { speaker: 'enemy.vesk', text: 'dlg.veskRift.1' },
    { speaker: 'char.tavi', text: 'dlg.veskRift.2' },
    { speaker: 'enemy.vesk', text: 'dlg.veskRift.3' },
    { speaker: 'enemy.vesk', text: 'dlg.veskRift.4' },
    { speaker: 'char.okun', text: 'dlg.veskRift.5' },
  ]),
  veskFalls: d('veskFalls', [
    { speaker: 'enemy.veskGrafted', text: 'dlg.veskFalls.1' },
    { speaker: 'enemy.veskGrafted', text: 'dlg.veskFalls.2' },
    { speaker: 'char.tavi', text: 'dlg.veskFalls.3' },
  ]),
  taviTaken: d('taviTaken', [
    { speaker: 'char.tavi', text: 'dlg.taviTaken.1' },
    { speaker: 'char.okun', text: 'dlg.taviTaken.2' },
    { speaker: 'char.tavi', text: 'dlg.taviTaken.3' },
  ]),
  okunAlone: d('okunAlone', [
    { speaker: 'char.okun', text: 'dlg.okunAlone.1' },
    { speaker: 'char.okun', text: 'dlg.okunAlone.2' },
  ]),
  ioleArrives: d('ioleArrives', [
    { speaker: 'npc.iole', text: 'dlg.ioleArrives.1' },
    { speaker: 'char.okun', text: 'dlg.ioleArrives.2' },
    { speaker: 'npc.iole', text: 'dlg.ioleArrives.3' },
    { speaker: 'npc.iole', text: 'dlg.ioleArrives.4' },
    { speaker: 'char.okun', text: 'dlg.ioleArrives.5' },
    { speaker: 'npc.iole', text: 'dlg.ioleArrives.6' },
  ]),
  siegeAlarm: d('siegeAlarm', [
    { speaker: 'npc.nilo', text: 'dlg.siegeAlarm.1' },
    { speaker: 'npc.nilo', text: 'dlg.siegeAlarm.2' },
    { speaker: 'npc.iole', text: 'dlg.siegeAlarm.3' },
    { speaker: 'npc.nilo', text: 'dlg.siegeAlarm.4' },
    { speaker: 'npc.iole', text: 'dlg.siegeAlarm.5' },
    { speaker: 'char.okun', text: 'dlg.siegeAlarm.6' },
    { speaker: 'npc.iole', text: 'dlg.siegeAlarm.7' },
  ]),
  cliffsArrive: d('cliffsArrive', [
    { speaker: 'npc.iole', text: 'dlg.cliffsArrive.1' },
    { speaker: 'char.okun', text: 'dlg.cliffsArrive.2' },
    { speaker: 'npc.iole', text: 'dlg.cliffsArrive.3' },
  ]),
  niloSiege: d('niloSiege', [
    { speaker: 'npc.nilo', text: 'dlg.niloSiege.1' },
    { speaker: 'npc.nilo', text: 'dlg.niloSiege.2' },
  ]),
  niloBarricade: d('niloBarricade', [
    { speaker: 'npc.nilo', text: 'dlg.niloBarricade.1' },
    { speaker: 'npc.nilo', text: 'dlg.niloBarricade.2' },
  ]),
  niloBarricadeOpen: d('niloBarricadeOpen', [
    { speaker: 'npc.nilo', text: 'dlg.niloBarricadeOpen.1' },
  ]),
  niloLetters: d('niloLetters', [
    { speaker: 'npc.nilo', text: 'dlg.niloLetters.1' },
    { speaker: 'npc.nilo', text: 'dlg.niloLetters.2' },
    { speaker: 'npc.iole', text: 'dlg.niloLetters.3' },
  ]),
  niloAfterSiege: d('niloAfterSiege', [{ speaker: 'npc.nilo', text: 'dlg.niloAfterSiege.1' }]),
  ramIntro: d('ramIntro', [
    { speaker: 'npc.iole', text: 'dlg.ramIntro.1' },
    { speaker: 'char.okun', text: 'dlg.ramIntro.2' },
  ]),
  ramCracks: d('ramCracks', [{ speaker: 'char.okun', text: 'dlg.ramCracks.1' }]),
  ramBroken: d('ramBroken', [
    { speaker: 'npc.iole', text: 'dlg.ramBroken.1' },
    { speaker: 'char.okun', text: 'dlg.ramBroken.2' },
  ]),
  sarnCliffs: d('sarnCliffs', [
    { speaker: 'enemy.sarn', text: 'dlg.sarnCliffs.1' },
    { speaker: 'npc.iole', text: 'dlg.sarnCliffs.2' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnCliffs.3' },
    { speaker: 'npc.iole', text: 'dlg.sarnCliffs.4' },
    { speaker: 'enemy.sarn', text: 'dlg.sarnCliffs.5' },
  ]),
  sarnOldWays: d('sarnOldWays', [{ speaker: 'enemy.sarnHollow', text: 'dlg.sarnOldWays.1' }]),
  sarnLastStand: d('sarnLastStand', [{ speaker: 'enemy.sarnHollow', text: 'dlg.sarnLastStand.1' }]),
  sarnYields: d('sarnYields', [
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnYields.1' },
    { speaker: 'npc.iole', text: 'dlg.sarnYields.2' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnYields.3' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnYields.4' },
    { speaker: 'char.okun', text: 'dlg.sarnYields.5' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnYields.6' },
    { speaker: 'npc.iole', text: 'dlg.sarnYields.7' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnYields.8' },
    { speaker: 'npc.iole', text: 'dlg.sarnYields.9' },
  ]),
  veskGrafted: d('veskGrafted', [
    { speaker: 'enemy.vesk', text: 'dlg.veskGrafted.1' },
    { speaker: 'enemy.vesk', text: 'dlg.veskGrafted.2' },
  ]),
  // --- Bajo la Tierra (chapter 7) ---
  taviWakes: d('taviWakes', [
    { speaker: 'char.tavi', text: 'dlg.taviWakes.1' },
    { speaker: 'char.tavi', text: 'dlg.taviWakes.2' },
    { speaker: 'char.tavi', text: 'dlg.taviWakes.3' },
  ]),
  fondoWhisper: d('fondoWhisper', [
    { speaker: 'npc.fondo', text: 'dlg.fondoWhisper.1' },
    { speaker: 'npc.fondo', text: 'dlg.fondoWhisper.2' },
    { speaker: 'char.tavi', text: 'dlg.fondoWhisper.3' },
  ]),
  echoA: d('echoA', [
    { speaker: 'npc.echoA', text: 'dlg.echoA.1' },
    { speaker: 'npc.echoA', text: 'dlg.echoA.2' },
    { speaker: 'npc.echoA', text: 'dlg.echoA.3' },
    { speaker: 'char.tavi', text: 'dlg.echoA.4' },
    { speaker: 'npc.echoA', text: 'dlg.echoA.5' },
  ]),
  echoB: d('echoB', [
    { speaker: 'npc.echoB', text: 'dlg.echoB.1' },
    { speaker: 'npc.echoB', text: 'dlg.echoB.2' },
    { speaker: 'npc.echoB', text: 'dlg.echoB.3' },
    { speaker: 'char.tavi', text: 'dlg.echoB.4' },
    { speaker: 'npc.echoB', text: 'dlg.echoB.5' },
  ]),
  echoC: d('echoC', [
    { speaker: 'npc.echoC', text: 'dlg.echoC.1' },
    { speaker: 'npc.echoC', text: 'dlg.echoC.2' },
    { speaker: 'npc.echoC', text: 'dlg.echoC.3' },
    { speaker: 'char.tavi', text: 'dlg.echoC.4' },
    { speaker: 'npc.echoC', text: 'dlg.echoC.5' },
  ]),
  echoesOpen: d('echoesOpen', [
    { speaker: 'npc.echoA', text: 'dlg.echoesOpen.1' },
    { speaker: 'npc.echoB', text: 'dlg.echoesOpen.2' },
    { speaker: 'npc.echoC', text: 'dlg.echoesOpen.3' },
  ]),
  echoRest: d('echoRest', [{ speaker: 'npc.echoA', text: 'dlg.echoRest.1' }]),
  echoHum: d('echoHum', [{ speaker: 'npc.echoB', text: 'dlg.echoHum.1' }]),
  shadowMeet: d('shadowMeet', [
    { speaker: 'enemy.taviShadow', text: 'dlg.shadowMeet.1' },
    { speaker: 'char.tavi', text: 'dlg.shadowMeet.2' },
    { speaker: 'enemy.taviShadow', text: 'dlg.shadowMeet.3' },
    { speaker: 'enemy.taviShadow', text: 'dlg.shadowMeet.4' },
    { speaker: 'char.tavi', text: 'dlg.shadowMeet.5' },
  ]),
  shadowDoubt: d('shadowDoubt', [{ speaker: 'enemy.taviShadow', text: 'dlg.shadowDoubt.1' }]),
  shadowLast: d('shadowLast', [{ speaker: 'enemy.taviShadow', text: 'dlg.shadowLast.1' }]),
  shadowAccepted: d('shadowAccepted', [
    { speaker: 'enemy.taviShadow', text: 'dlg.shadowAccepted.1' },
    { speaker: 'char.tavi', text: 'dlg.shadowAccepted.2' },
    { speaker: 'char.tavi', text: 'dlg.shadowAccepted.3' },
    { speaker: 'enemy.taviShadow', text: 'dlg.shadowAccepted.4' },
    { speaker: 'char.tavi', text: 'dlg.shadowAccepted.5' },
  ]),
  deepTideGained: d('deepTideGained', [
    { speaker: 'char.tavi', text: 'dlg.deepTideGained.1' },
    { speaker: 'char.tavi', text: 'dlg.deepTideGained.2' },
  ]),
  reunion: d('reunion', [
    { speaker: 'char.okun', text: 'dlg.reunion.1' },
    { speaker: 'npc.iole', text: 'dlg.reunion.2' },
    { speaker: 'char.tavi', text: 'dlg.reunion.3' },
    { speaker: 'npc.iole', text: 'dlg.reunion.4' },
    { speaker: 'char.okun', text: 'dlg.reunion.5' },
    { speaker: 'char.tavi', text: 'dlg.reunion.6' },
    { speaker: 'npc.iole', text: 'dlg.reunion.7' },
  ]),
  // --- Las Tres Luces (chapter 8) ---
  archiveCollapse: d('archiveCollapse', [
    { speaker: 'npc.nilo', text: 'dlg.archiveCollapse.1' },
    { speaker: 'npc.nilo', text: 'dlg.archiveCollapse.2' },
    { speaker: 'npc.iole', text: 'dlg.archiveCollapse.3' },
    { speaker: 'npc.nilo', text: 'dlg.archiveCollapse.4' },
  ]),
  pimRescued: d('pimRescued', [
    { speaker: 'npc.pim', text: 'dlg.pimRescued.1' },
    { speaker: 'npc.pim', text: 'dlg.pimRescued.2' },
    { speaker: 'npc.pim', text: 'dlg.pimRescued.3' },
    { speaker: 'npc.pim', text: 'dlg.pimRescued.4' },
    { speaker: 'npc.iole', text: 'dlg.pimRescued.5' },
  ]),
  niloJoins: d('niloJoins', [
    { speaker: 'npc.nilo', text: 'dlg.niloJoins.1' },
    { speaker: 'npc.iole', text: 'dlg.niloJoins.2' },
    { speaker: 'npc.nilo', text: 'dlg.niloJoins.3' },
    { speaker: 'char.tavi', text: 'dlg.niloJoins.4' },
  ]),
  pimLights: d('pimLights', [
    { speaker: 'npc.pim', text: 'dlg.pimLights.1' },
    { speaker: 'npc.pim', text: 'dlg.pimLights.2' },
  ]),
  golemIntro: d('golemIntro', [
    { speaker: 'enemy.ancientGolem', text: 'dlg.golemIntro.1' },
    { speaker: 'npc.nilo', text: 'dlg.golemIntro.2' },
  ]),
  golemWakes: d('golemWakes', [{ speaker: 'enemy.ancientGolem', text: 'dlg.golemWakes.1' }]),
  golemLight: d('golemLight', [
    { speaker: 'char.tavi', text: 'dlg.golemLight.1' },
    { speaker: 'npc.nilo', text: 'dlg.golemLight.2' },
  ]),
  motherIntro: d('motherIntro', [
    { speaker: 'npc.iole', text: 'dlg.motherIntro.1' },
    { speaker: 'enemy.brineMother', text: 'dlg.motherIntro.2' },
  ]),
  motherHatch: d('motherHatch', [{ speaker: 'npc.nilo', text: 'dlg.motherHatch.1' }]),
  motherLight: d('motherLight', [
    { speaker: 'npc.iole', text: 'dlg.motherLight.1' },
    { speaker: 'char.tavi', text: 'dlg.motherLight.2' },
  ]),
  quarryIntro: d('quarryIntro', [
    { speaker: 'enemy.quarryEcho', text: 'dlg.quarryIntro.1' },
    { speaker: 'char.okun', text: 'dlg.quarryIntro.2' },
  ]),
  quarryRespect: d('quarryRespect', [{ speaker: 'enemy.quarryEcho', text: 'dlg.quarryRespect.1' }]),
  quarryLight: d('quarryLight', [
    { speaker: 'enemy.quarryEcho', text: 'dlg.quarryLight.1' },
    { speaker: 'char.okun', text: 'dlg.quarryLight.2' },
  ]),
  threeLights: d('threeLights', [
    { speaker: 'npc.pim', text: 'dlg.threeLights.1' },
    { speaker: 'npc.iole', text: 'dlg.threeLights.2' },
    { speaker: 'char.okun', text: 'dlg.threeLights.3' },
    { speaker: 'npc.nilo', text: 'dlg.threeLights.4' },
    { speaker: 'char.tavi', text: 'dlg.threeLights.5' },
    { speaker: 'npc.iole', text: 'dlg.threeLights.6' },
  ]),
  // --- El Fondo (chapter 9), the ending and the post-game ---
  riftDescent: d('riftDescent', [
    { speaker: 'npc.iole', text: 'dlg.riftDescent.1' },
    { speaker: 'char.okun', text: 'dlg.riftDescent.2' },
    { speaker: 'npc.nilo', text: 'dlg.riftDescent.3' },
    { speaker: 'char.tavi', text: 'dlg.riftDescent.4' },
  ]),
  abyssArrive: d('abyssArrive', [
    { speaker: 'char.tavi', text: 'dlg.abyssArrive.1' },
    { speaker: 'char.okun', text: 'dlg.abyssArrive.2' },
    { speaker: 'npc.iole', text: 'dlg.abyssArrive.3' },
    { speaker: 'npc.nilo', text: 'dlg.abyssArrive.4' },
    { speaker: 'char.tavi', text: 'dlg.abyssArrive.5' },
  ]),
  niloCourage: d('niloCourage', [
    { speaker: 'char.okun', text: 'dlg.niloCourage.1' },
    { speaker: 'npc.iole', text: 'dlg.niloCourage.2' },
    { speaker: 'npc.nilo', text: 'dlg.niloCourage.3' },
    { speaker: 'npc.nilo', text: 'dlg.niloCourage.4' },
    { speaker: 'char.tavi', text: 'dlg.niloCourage.5' },
    { speaker: 'npc.nilo', text: 'dlg.niloCourage.6' },
  ]),
  hordeComes: d('hordeComes', [
    { speaker: 'npc.iole', text: 'dlg.hordeComes.1' },
    { speaker: 'char.okun', text: 'dlg.hordeComes.2' },
  ]),
  sarnDebt: d('sarnDebt', [
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnDebt.1' },
    { speaker: 'npc.iole', text: 'dlg.sarnDebt.2' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnDebt.3' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnDebt.4' },
  ]),
  sarnStays: d('sarnStays', [
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnStays.1' },
    { speaker: 'npc.iole', text: 'dlg.sarnStays.2' },
    { speaker: 'enemy.sarnHollow', text: 'dlg.sarnStays.3' },
    { speaker: 'npc.nilo', text: 'dlg.sarnStays.4' },
  ]),
  veskFinalIntro: d('veskFinalIntro', [
    { speaker: 'enemy.veskFinal', text: 'dlg.veskFinalIntro.1' },
    { speaker: 'char.tavi', text: 'dlg.veskFinalIntro.2' },
    { speaker: 'enemy.veskFinal', text: 'dlg.veskFinalIntro.3' },
    { speaker: 'char.okun', text: 'dlg.veskFinalIntro.4' },
  ]),
  veskEternal: d('veskEternal', [{ speaker: 'enemy.veskFinal', text: 'dlg.veskEternal.1' }]),
  veskCracks: d('veskCracks', [{ speaker: 'enemy.veskFinal', text: 'dlg.veskCracks.1' }]),
  veskFinalFalls: d('veskFinalFalls', [
    { speaker: 'enemy.veskFinal', text: 'dlg.veskFinalFalls.1' },
    { speaker: 'char.okun', text: 'dlg.veskFinalFalls.2' },
    { speaker: 'enemy.veskFinal', text: 'dlg.veskFinalFalls.3' },
  ]),
  veskGone: d('veskGone', [
    { speaker: 'npc.nilo', text: 'dlg.veskGone.1' },
    { speaker: 'npc.iole', text: 'dlg.veskGone.2' },
  ]),
  fondoIntro: d('fondoIntro', [
    { speaker: 'enemy.fondoHeart', text: 'dlg.fondoIntro.1' },
    { speaker: 'char.tavi', text: 'dlg.fondoIntro.2' },
    { speaker: 'enemy.fondoHeart', text: 'dlg.fondoIntro.3' },
    { speaker: 'npc.nilo', text: 'dlg.fondoIntro.4' },
  ]),
  fondoHunger: d('fondoHunger', [{ speaker: 'enemy.fondoHeart', text: 'dlg.fondoHunger.1' }]),
  fondoWakes: d('fondoWakes', [
    { speaker: 'enemy.fondoAwake', text: 'dlg.fondoWakes.1' },
    { speaker: 'char.okun', text: 'dlg.fondoWakes.2' },
    { speaker: 'npc.iole', text: 'dlg.fondoWakes.3' },
  ]),
  fondoFalls: d('fondoFalls', [
    { speaker: 'enemy.fondoHeart', text: 'dlg.fondoFalls.1' },
    { speaker: 'char.tavi', text: 'dlg.fondoFalls.2' },
    { speaker: 'npc.iole', text: 'dlg.fondoFalls.3' },
    { speaker: 'char.tavi', text: 'dlg.fondoFalls.4' },
  ]),
  newAnchor: d('newAnchor', [
    { speaker: 'char.tavi', text: 'dlg.newAnchor.1' },
    { speaker: 'npc.nilo', text: 'dlg.newAnchor.2' },
    { speaker: 'char.okun', text: 'dlg.newAnchor.3' },
    { speaker: 'npc.iole', text: 'dlg.newAnchor.4' },
  ]),
  epilogue: d('epilogue', [
    { speaker: 'npc.pim', text: 'dlg.epilogue.1' },
    { speaker: 'char.okun', text: 'dlg.epilogue.2' },
    { speaker: 'npc.nilo', text: 'dlg.epilogue.3' },
    { speaker: 'npc.pim', text: 'dlg.epilogue.4' },
  ]),
  epilogueIole: d('epilogueIole', [
    { speaker: 'npc.iole', text: 'dlg.epilogueIole.1' },
    { speaker: 'npc.iole', text: 'dlg.epilogueIole.2' },
    { speaker: 'npc.iole', text: 'dlg.epilogueIole.3' },
    { speaker: 'char.tavi', text: 'dlg.epilogueIole.4' },
    { speaker: 'char.tavi', text: 'dlg.epilogueIole.5' },
    { speaker: 'npc.iole', text: 'dlg.epilogueIole.6' },
  ]),
  echoIntro: d('echoIntro', [
    { speaker: 'enemy.fondoEcho', text: 'dlg.echoIntro.1' },
    { speaker: 'char.tavi', text: 'dlg.echoIntro.2' },
  ]),
  echoMock: d('echoMock', [{ speaker: 'enemy.fondoEcho', text: 'dlg.echoMock.1' }]),
  echoLast: d('echoLast', [{ speaker: 'enemy.fondoEcho', text: 'dlg.echoLast.1' }]),
  echoGone: d('echoGone', [
    { speaker: 'enemy.fondoEcho', text: 'dlg.echoGone.1' },
    { speaker: 'npc.iole', text: 'dlg.echoGone.2' },
  ]),
  iolePostGame: d('iolePostGame', [
    { speaker: 'npc.iole', text: 'dlg.iolePostGame.1' },
    { speaker: 'npc.iole', text: 'dlg.iolePostGame.2' },
  ]),
  pimComplete: d('pimComplete', [
    { speaker: 'npc.pim', text: 'dlg.pimComplete.1' },
    { speaker: 'npc.pim', text: 'dlg.pimComplete.2' },
  ]),
  sarnPostGame: d('sarnPostGame', [
    { speaker: 'npc.sarn', text: 'dlg.sarnPostGame.1' },
    { speaker: 'npc.sarn', text: 'dlg.sarnPostGame.2' },
  ]),
  maelaAsk: d('maelaAsk', [
    { speaker: 'npc.maela', text: 'dlg.maelaAsk.1' },
    { speaker: 'npc.maela', text: 'dlg.maelaAsk.2' },
  ]),
  maelaPaySpawn: d('maelaPaySpawn', [{ speaker: 'npc.maela', text: 'dlg.maelaPaySpawn.1' }]),
  maelaAskWisps: d('maelaAskWisps', [{ speaker: 'npc.maela', text: 'dlg.maelaAskWisps.1' }]),
  maelaPayWisps: d('maelaPayWisps', [{ speaker: 'npc.maela', text: 'dlg.maelaPayWisps.1' }]),
  maelaAskEcho: d('maelaAskEcho', [{ speaker: 'npc.maela', text: 'dlg.maelaAskEcho.1' }]),
  maelaPayEcho: d('maelaPayEcho', [
    { speaker: 'npc.maela', text: 'dlg.maelaPayEcho.1' },
    { speaker: 'npc.maela', text: 'dlg.maelaPayEcho.2' },
  ]),
  maelaDone: d('maelaDone', [{ speaker: 'npc.maela', text: 'dlg.maelaDone.1' }]),
};

export function getDialogue(id: string): DialogueDef {
  const def = DIALOGUES[id];
  if (!def) throw new Error(`Unknown dialogue: ${id}`);
  return def;
}
