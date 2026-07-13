export const en = {
  'app.title': 'Catch the King',
  'app.subtitle': 'helper',
  'nav.helper': 'Helper',
  'nav.practice': 'Practice',
  'nav.review': 'Review',
  'nav.stats': 'Stats',
  'nav.help': 'Rules',

  'panel.currentCard': 'Current card',
  'panel.goldChance': 'Gold chance',
  'panel.remaining': 'Still hidden',
  'panel.topMoves': 'Best moves',
  'panel.keys': 'Keyboard',

  'suggest.thinking': 'Analyzing…',
  'suggest.reveal': 'Reveal {cell}',
  'suggest.catch': 'Catch {cell}',
  'suggest.gameOver': 'Game over — {score} points, {chest}',
  'suggest.invalid': 'Inputs look contradictory — check the last flash / value.',

  'action.undo': 'Undo',
  'action.redo': 'Redo',
  'action.heatmap': '5-heatmap',
  'action.sound': 'Sound',
  'action.newGame': 'New game',
  'action.cancel': 'Cancel',

  'picker.reveal': 'What did {cell} show?',
  'picker.catch': 'Catch {cell} with your {hand}?',
  'picker.catchBtn': 'Catch (+{pts})',
  'picker.captured': 'My 5 was captured',
  'picker.flashed': 'Card flashed (red glow)',

  'keys.hover': 'hover a card + value = reveal',
  'keys.shift': 'with flash',
  'keys.select': 'click face-down card = select it',
  'keys.click': 'click face-up card = instant catch',
  'keys.undo': 'undo',
  'keys.new': 'clear selection · new game',

  'hint.selected':
    '<b>{cell}</b> — press <kbd>1</kbd>–<kbd>5</kbd> or <kbd>K</kbd> for its value · hold <kbd>Shift</kbd> if it flashed red',

  'fx.captured': 'Captured!',
  'fx.bingo': 'BINGO',
  'fx.goldLocked': 'GOLD GUARANTEED!',
  'fx.goldLockedSub': '100% gold chance — bring it home.',
  'fx.goldWin': 'GOLDEN KING’S LOOT!',
  'fx.goldWinSub': '{score} points — the gold chest is yours.',

  'chest.gold': 'Golden King’s Loot',
  'chest.silver': 'Silver chest',
  'chest.bronze': 'Bronze chest',
  'chest.none': 'no chest',

  'reason.opener': 'Opener: pins down the 5s fast',
  'reason.chainCatch': 'Free catch — points, turn continues',
  'reason.bankCatch': 'Banks the turn safely',
  'reason.info': 'Best information about the 5s',
  'reason.chain': 'Best chance to keep the chain alive',
  'reason.bingo': 'Advances a bingo line',
  'reason.king': 'Likely the King',
  'reason.safeFive': 'Provably safe on the 5-turn',
  'reason.exact': 'Exact endgame calculation',

  'practice.chip': 'Practice',
  'practice.banner': 'Simulated board — train without spending King Decks.',
  'practice.coachToggle': 'Coach',
  'practice.coach': 'Coach',
  'practice.agree': 'Good — the solver agrees with {cell}.',
  'practice.differ': 'Solver preferred {best} over {chosen}.',

  'review.title': 'Game review',
  'review.blurb': 'Every move is re-evaluated by the solver. See where your gold chance was won or lost.',
  'review.analyze': 'Analyze last game',
  'review.none': 'No finished game yet. Play one in Helper or Practice mode.',
  'review.progress': 'Analyzing move {i} of {n}…',
  'review.chartTitle': 'Gold chance over the game',
  'review.betterWas': 'better: {move} ({p}%)',
  'review.summary': '{best} best · {good} good · {inaccuracy} inaccuracies · {blunder} blunders',
  'review.moveReveal': 'Reveal {cell}',
  'review.moveCatch': 'Catch {cell}',

  'grade.best': 'best',
  'grade.good': 'good',
  'grade.inaccuracy': 'inaccuracy',
  'grade.blunder': 'blunder',

  'stats.title': 'Your record',
  'stats.export': 'Export',
  'stats.import': 'Import',
  'stats.wipe': 'Reset stats',
  'stats.wipeConfirm': 'Delete all locally stored games?',
  'stats.games': 'Games',
  'stats.goldRate': 'Gold rate',
  'stats.avgScore': 'Avg score',
  'stats.bestScore': 'Best score',
  'stats.distTitle': 'Score distribution',
  'stats.recentTitle': 'Recent games',
  'stats.empty': 'Nothing here yet — finish a game and it will be recorded automatically.',
  'stats.mode.helper': 'live',
  'stats.mode.practice': 'practice',

  'foot.line': 'Free & open-source fan tool. Not affiliated with Gameforge.',

  'help.html': `
<h2>Catch the King — rules</h2>
<p><b>Catch the King</b> (German: <i>Schnapp den König</i>) is a Metin2 event mini-game. 25 cards lie face-down on a 5×5 board; you play a fixed hand of 12 cards and want <b>550+ points</b> for the <b>Golden King's Loot</b>.</p>
<table>
<tr><th>Card</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>K</td></tr>
<tr><th>On board</th><td>7×</td><td>4×</td><td>5×</td><td>5×</td><td>3×</td><td>1×</td></tr>
<tr><th>Points</th><td>10</td><td>20</td><td>30</td><td>40</td><td>50</td><td>100</td></tr>
</table>
<p>Your hand, played in order: <b>1 1 1 1 1 2 2 3 3 4 5 K</b>. Each turn you flip a face-down card (or <i>catch</i> a face-up unscored one):</p>
<ul>
<li><b>Hand higher</b> → you score the card and keep going (chain).</li>
<li><b>Equal</b> → you score it, turn ends.</li>
<li><b>Hand lower</b> → no points, turn ends — but the card stays face-up and can be caught later.</li>
</ul>
<div class="callout"><b>The King rule:</b> the K hand card never chains — it beats <i>only</i> the board King (+100). Everything else loses. Revealing the King early with a cheap card is therefore great: your K-turn becomes a guaranteed +100.</div>
<h3>The 5-rule and flashing</h3>
<p>If a face-down 5 sits next to a card you flip (8 neighbors), the flipped card <b>flashes red</b>. On your 5-turn, flipping or catching next to a 5 gets your hand-5 <b>captured</b>: zero points, turn over. Mark flashes in the helper — they are how the solver pins the 5s down.</p>
<h3>Bingo</h3>
<p>Score all 5 cells of a row, column or diagonal for <b>+10</b> each (12 lines).</p>
<h3>Chests</h3>
<ul><li>\u{1F9F0} Bronze: 100–399</li><li>\u{1F948} Silver: 400–549</li><li>\u{1F3C6} <b>Gold: 550+</b></li></ul>
<h2>How the helper works</h2>
<p>Enter what you see in-game: tap a card, pick its value, tick “flashed” if it glowed. The solver tracks the exact probability of every hidden card, suggests the strongest move, and shows your live gold chance. The suggestion engine combines an opening book, chain economics, Monte-Carlo rollouts and an exact endgame calculation.</p>
<h3>Strategy in three lines</h3>
<ul>
<li><b>Reveals are everything.</b> Almost every card you flip gets scored eventually — by you now, or by a later hand as a catch. Extend turns, flip a lot.</li>
<li><b>Respect the 5s.</b> Locate them early (the opener does), keep safe cells for the 5-turn, and never flip next to a possible 5 with your 5.</li>
<li><b>Find the King early.</b> Losing one cheap turn to reveal the K locks in +100.</li>
</ul>
<p class="muted">Practice mode deals you unlimited simulated boards — train the risk decisions before spending real King Decks.</p>
`,
};
