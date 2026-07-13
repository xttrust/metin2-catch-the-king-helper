export const de = {
  'app.title': 'Schnapp den König',
  'app.subtitle': 'Helfer',
  'nav.helper': 'Helfer',
  'nav.practice': 'Training',
  'nav.review': 'Analyse',
  'nav.stats': 'Statistik',
  'nav.help': 'Regeln',

  'panel.currentCard': 'Aktuelle Karte',
  'panel.goldChance': 'Gold-Chance',
  'panel.remaining': 'Noch verdeckt',
  'panel.topMoves': 'Beste Züge',
  'panel.keys': 'Tastatur',

  'suggest.thinking': 'Analysiere…',
  'suggest.reveal': 'Decke {cell} auf',
  'suggest.catch': 'Fange {cell}',
  'suggest.gameOver': 'Spiel vorbei — {score} Punkte, {chest}',
  'suggest.invalid': 'Eingaben widersprechen sich — prüfe letztes Blinken / letzten Wert.',

  'action.undo': 'Rückgängig',
  'action.redo': 'Wiederholen',
  'action.heatmap': '5er-Heatmap',
  'action.newGame': 'Neues Spiel',
  'action.cancel': 'Abbrechen',

  'picker.reveal': 'Was zeigte {cell}?',
  'picker.catch': '{cell} mit deiner {hand} fangen?',
  'picker.catchBtn': 'Fangen (+{pts})',
  'picker.captured': 'Meine 5 wurde geschnappt',
  'picker.flashed': 'Karte hat geblinkt (rotes Leuchten)',

  'keys.hover': 'Karte + Zahl = aufdecken',
  'keys.shift': 'mit Blinken',
  'keys.click': 'Klick auf offene Karte = fangen',
  'keys.undo': 'rückgängig',
  'keys.new': 'neues Spiel',

  'chest.gold': 'Goldene Königsbeute',
  'chest.silver': 'Silberne Truhe',
  'chest.bronze': 'Bronzene Truhe',
  'chest.none': 'keine Truhe',

  'reason.opener': 'Opener: lokalisiert die 5er schnell',
  'reason.chainCatch': 'Gratis-Fang — Punkte, Runde läuft weiter',
  'reason.bankCatch': 'Sichert die Runde ab',
  'reason.info': 'Beste Information über die 5er',
  'reason.chain': 'Beste Chance, die Kette am Leben zu halten',
  'reason.bingo': 'Bringt eine Bingo-Linie voran',
  'reason.king': 'Wahrscheinlich der König',
  'reason.safeFive': 'Nachweislich sicher in der 5er-Runde',
  'reason.exact': 'Exakte Endspiel-Berechnung',

  'practice.chip': 'Training',
  'practice.banner': 'Simuliertes Brett — üben ohne Königsdecks auszugeben.',
  'practice.coachToggle': 'Coach',
  'practice.coach': 'Coach',
  'practice.agree': 'Gut — der Solver stimmt {cell} zu.',
  'practice.differ': 'Der Solver bevorzugte {best} statt {chosen}.',

  'review.title': 'Spiel-Analyse',
  'review.blurb': 'Jeder Zug wird vom Solver neu bewertet. Sieh, wo deine Gold-Chance gewonnen oder verloren wurde.',
  'review.analyze': 'Letztes Spiel analysieren',
  'review.none': 'Noch kein beendetes Spiel. Spiele eins im Helfer- oder Trainingsmodus.',
  'review.progress': 'Analysiere Zug {i} von {n}…',
  'review.chartTitle': 'Gold-Chance im Spielverlauf',
  'review.betterWas': 'besser: {move} ({p}%)',
  'review.summary': '{best} beste · {good} gute · {inaccuracy} Ungenauigkeiten · {blunder} Patzer',
  'review.moveReveal': '{cell} aufdecken',
  'review.moveCatch': '{cell} fangen',

  'grade.best': 'beste',
  'grade.good': 'gut',
  'grade.inaccuracy': 'ungenau',
  'grade.blunder': 'Patzer',

  'stats.title': 'Deine Bilanz',
  'stats.export': 'Export',
  'stats.import': 'Import',
  'stats.wipe': 'Statistik löschen',
  'stats.wipeConfirm': 'Alle lokal gespeicherten Spiele löschen?',
  'stats.games': 'Spiele',
  'stats.goldRate': 'Gold-Quote',
  'stats.avgScore': 'Ø Punkte',
  'stats.bestScore': 'Bestwert',
  'stats.distTitle': 'Punkteverteilung',
  'stats.recentTitle': 'Letzte Spiele',
  'stats.empty': 'Noch nichts hier — beende ein Spiel, es wird automatisch gespeichert.',
  'stats.mode.helper': 'live',
  'stats.mode.practice': 'Training',

  'foot.line': 'Kostenloses Open-Source-Fantool. Nicht mit Gameforge verbunden.',

  'help.html': `
<h2>Schnapp den König — Regeln</h2>
<p><b>Schnapp den König</b> ist ein Metin2-Event-Minispiel. 25 Karten liegen verdeckt auf einem 5×5-Brett; du spielst eine feste Hand aus 12 Karten und willst <b>550+ Punkte</b> für die <b>Goldene Königsbeute</b>.</p>
<table>
<tr><th>Karte</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>K</td></tr>
<tr><th>Im Brett</th><td>7×</td><td>4×</td><td>5×</td><td>5×</td><td>3×</td><td>1×</td></tr>
<tr><th>Punkte</th><td>10</td><td>20</td><td>30</td><td>40</td><td>50</td><td>100</td></tr>
</table>
<p>Deine Hand, in dieser Reihenfolge: <b>1 1 1 1 1 2 2 3 3 4 5 K</b>. Pro Zug deckst du eine verdeckte Karte auf (oder <i>fängst</i> eine offene, ungewertete):</p>
<ul>
<li><b>Hand höher</b> → Punkte, und du machst weiter (Kette).</li>
<li><b>Gleich</b> → Punkte, Runde endet.</li>
<li><b>Hand niedriger</b> → keine Punkte, Runde endet — die Karte bleibt aber offen und kann später gefangen werden.</li>
</ul>
<div class="callout"><b>Die Königsregel:</b> die K-Handkarte kettet nie — sie schlägt <i>nur</i> den Brett-König (+100). Alles andere verliert. Den König früh mit einer billigen Karte aufzudecken lohnt sich: deine K-Runde wird zu garantierten +100.</div>
<h3>Die 5er-Regel und das Blinken</h3>
<p>Liegt eine verdeckte 5 neben einer Karte, die du aufdeckst (8 Nachbarn), <b>blinkt</b> diese rot. In deiner 5er-Runde wird deine Hand-5 neben einer 5 <b>geschnappt</b>: null Punkte, Runde vorbei. Markiere Blinken im Helfer — so lokalisiert der Solver die 5er.</p>
<h3>Bingo</h3>
<p>Werte alle 5 Felder einer Reihe, Spalte oder Diagonale für je <b>+10</b> (12 Linien).</p>
<h3>Truhen</h3>
<ul><li>\u{1F9F0} Bronze: 100–399</li><li>\u{1F948} Silber: 400–549</li><li>\u{1F3C6} <b>Gold: 550+</b></li></ul>
<h2>So funktioniert der Helfer</h2>
<p>Gib ein, was du im Spiel siehst: Karte antippen, Wert wählen, „geblinkt“ ankreuzen, wenn sie leuchtete. Der Solver berechnet die exakten Wahrscheinlichkeiten jeder verdeckten Karte, schlägt den stärksten Zug vor und zeigt deine Gold-Chance live. Die Engine kombiniert Eröffnungsbuch, Ketten-Ökonomie, Monte-Carlo-Rollouts und exakte Endspielrechnung.</p>
<h3>Strategie in drei Zeilen</h3>
<ul>
<li><b>Aufdecken ist alles.</b> Fast jede aufgedeckte Karte wird irgendwann gewertet — jetzt von dir oder später als Fang. Verlängere Runden, decke viel auf.</li>
<li><b>Respektiere die 5er.</b> Früh lokalisieren (macht der Opener), sichere Felder für die 5er-Runde aufheben, mit der 5 nie neben eine mögliche 5.</li>
<li><b>Finde den König früh.</b> Eine billige Runde zu opfern sichert +100.</li>
</ul>
<p class="muted">Der Trainingsmodus teilt dir unbegrenzt simulierte Bretter aus — üben, bevor echte Königsdecks draufgehen.</p>
`,
};
