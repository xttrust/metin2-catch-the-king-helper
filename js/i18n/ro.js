export const ro = {
  'app.title': 'Prinde Regele',
  'app.subtitle': 'asistent',
  'nav.helper': 'Asistent',
  'nav.practice': 'Antrenament',
  'nav.review': 'Analiză',
  'nav.stats': 'Statistici',
  'nav.help': 'Reguli',

  'panel.currentCard': 'Cartea curentă',
  'panel.goldChance': 'Șansă la aur',
  'panel.remaining': 'Încă ascunse',
  'panel.topMoves': 'Cele mai bune mutări',
  'panel.keys': 'Tastatură',

  'suggest.thinking': 'Analizez…',
  'suggest.reveal': 'Întoarce {cell}',
  'suggest.catch': 'Prinde {cell}',
  'suggest.gameOver': 'Joc terminat — {score} puncte, {chest}',
  'suggest.invalid': 'Datele introduse se contrazic — verifică ultima valoare sau bifa „5 e pe lângă”.',

  'action.undo': 'Înapoi',
  'action.redo': 'Repetă',
  'action.heatmap': 'Heatmap 5',
  'action.sound': 'Sunet',
  'action.newGame': 'Joc nou',
  'action.cancel': 'Anulează',

  'picker.reveal': 'Ce a arătat {cell}?',
  'picker.catch': 'Prinzi {cell} cu {hand}?',
  'picker.catchBtn': 'Prinde (+{pts})',
  'picker.captured': '5-ul meu a fost capturat',
  'picker.flashed': '5 e pe lângă (cartea a strălucit roșu)',

  'keys.hover': 'cursor pe carte + cifră = întoarce',
  'keys.shift': 'când 5 e pe lângă',
  'keys.select': 'click pe carte ascunsă = o selectezi',
  'keys.click': 'click pe carte întoarsă = prindere instant',
  'keys.undo': 'înapoi',
  'keys.new': 'anulează selecția · joc nou',

  'hint.selected':
    '<b>{cell}</b> — apasă <kbd>1</kbd>–<kbd>5</kbd> sau <kbd>K</kbd> pentru valoare · ține <kbd>Shift</kbd> dacă 5 e pe lângă',

  'fx.captured': 'Capturat!',
  'fx.bingo': 'BINGO',
  'fx.goldLocked': 'AUR GARANTAT!',
  'fx.goldLockedSub': 'Șansa la aur e 100% — e ca și câștigat.',
  'fx.goldWin': 'PRADA DE AUR A REGELUI!',
  'fx.goldWinSub': '{score} puncte — cufărul de aur e al tău.',

  'chest.gold': 'Prada de Aur a Regelui',
  'chest.silver': 'Cufăr de argint',
  'chest.bronze': 'Cufăr de bronz',
  'chest.none': 'fără cufăr',

  'reason.opener': 'Deschidere: localizează rapid 5-urile',
  'reason.chainCatch': 'Prindere gratuită — iei punctele și tura continuă',
  'reason.bankCatch': 'Încheie tura în siguranță',
  'reason.info': 'Afli cel mai mult despre 5-uri',
  'reason.chain': 'Cea mai bună șansă să continui lanțul',
  'reason.bingo': 'Te apropie de un bingo',
  'reason.king': 'Probabil Regele',
  'reason.safeFive': 'Dovedit sigur pentru tura de 5',
  'reason.exact': 'Calcul exact de final',

  'practice.chip': 'Antrenament',
  'practice.banner': 'Tablă simulată — exersează fără să consumi King Decks.',
  'practice.coachToggle': 'Antrenor',
  'practice.coach': 'Antrenor',
  'practice.agree': 'Bine — solverul e de acord cu {cell}.',
  'practice.differ': 'Solverul ar fi ales {best} în loc de {chosen}.',

  'review.title': 'Analiza jocului',
  'review.blurb': 'Fiecare mutare este reevaluată de solver. Vezi unde ai câștigat sau pierdut șansa la aur.',
  'review.analyze': 'Analizează ultimul joc',
  'review.none': 'Niciun joc terminat încă. Joacă unul în modul Asistent sau Antrenament.',
  'review.progress': 'Analizez mutarea {i} din {n}…',
  'review.chartTitle': 'Șansa la aur pe parcursul jocului',
  'review.betterWas': 'mai bine: {move} ({p}%)',
  'review.summary': '{best} perfecte · {good} bune · {inaccuracy} imprecizii · {blunder} gafe',
  'review.moveReveal': 'Întoarce {cell}',
  'review.moveCatch': 'Prinde {cell}',

  'grade.best': 'perfectă',
  'grade.good': 'bună',
  'grade.inaccuracy': 'imprecizie',
  'grade.blunder': 'gafă',

  'stats.title': 'Palmaresul tău',
  'stats.export': 'Export',
  'stats.import': 'Import',
  'stats.wipe': 'Șterge statistici',
  'stats.wipeConfirm': 'Ștergi toate jocurile salvate local?',
  'stats.games': 'Jocuri',
  'stats.goldRate': 'Rată aur',
  'stats.avgScore': 'Scor mediu',
  'stats.bestScore': 'Cel mai bun scor',
  'stats.distTitle': 'Distribuția scorurilor',
  'stats.recentTitle': 'Jocuri recente',
  'stats.empty': 'Nimic aici încă — termină un joc și va fi salvat automat.',
  'stats.mode.helper': 'live',
  'stats.mode.practice': 'antrenament',

  'foot.line': 'Unealtă gratuită, open-source, făcută de fani. Neafiliată cu Gameforge.',

  'help.html': `
<h2>Prinde Regele — reguli</h2>
<p><b>Prinde Regele</b> (engleză: <i>Catch the King</i>) este un mini-joc de eveniment din Metin2. 25 de cărți stau cu fața în jos pe o tablă 5×5; joci o mână fixă de 12 cărți și vrei <b>550+ puncte</b> pentru <b>Prada de Aur a Regelui</b>.</p>
<table>
<tr><th>Carte</th><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>K</td></tr>
<tr><th>Pe tablă</th><td>7×</td><td>4×</td><td>5×</td><td>5×</td><td>3×</td><td>1×</td></tr>
<tr><th>Puncte</th><td>10</td><td>20</td><td>30</td><td>40</td><td>50</td><td>100</td></tr>
</table>
<p>Mâna ta, jucată în ordine: <b>1 1 1 1 1 2 2 3 3 4 5 K</b>. În fiecare tură întorci o carte (sau <i>prinzi</i> una întoarsă, nepunctată):</p>
<ul>
<li><b>Mâna mai mare</b> → punctezi cartea și continui (lanț).</li>
<li><b>Egal</b> → punctezi, tura se termină.</li>
<li><b>Mâna mai mică</b> → zero puncte, tura se termină — dar cartea rămâne întoarsă și poate fi prinsă mai târziu.</li>
</ul>
<div class="callout"><b>Regula Regelui:</b> cartea K din mână nu face lanț — bate <i>doar</i> Regele de pe tablă (+100). Cu orice altceva pierde. Să întorci Regele devreme cu o carte ieftină e excelent: tura ta de K devine un +100 garantat.</div>
<h3>Regula 5-ului și strălucirea roșie</h3>
<p>Dacă un 5 ascuns e lângă cartea pe care o întorci (pe oricare din cele 8 câmpuri vecine), cartea <b>strălucește roșu</b> — adică „5 e pe lângă”. În tura ta de 5, dacă întorci sau prinzi o carte lângă un 5, 5-ul tău e <b>capturat</b>: zero puncte, tura pierdută. Bifează „5 e pe lângă” în asistent — așa localizează solverul 5-urile.</p>
<h3>Bingo</h3>
<p>Punctează toate cele 5 celule ale unui rând, coloană sau diagonală pentru <b>+10</b> fiecare (12 linii).</p>
<h3>Cufere</h3>
<ul><li>\u{1F9F0} Bronz: 100–399</li><li>\u{1F948} Argint: 400–549</li><li>\u{1F3C6} <b>Aur: 550+</b></li></ul>
<h2>Cum funcționează asistentul</h2>
<p>Introdu ce vezi în joc: apasă pe o carte, alege valoarea și bifează „5 e pe lângă” dacă a strălucit roșu. Solverul calculează probabilitățile exacte ale fiecărei cărți ascunse, sugerează cea mai bună mutare și arată live șansa la aur. Motorul combină o carte de deschideri, economia lanțurilor, simulări Monte-Carlo și calcul exact de final.</p>
<h3>Strategia în trei rânduri</h3>
<ul>
<li><b>Întoarcerile sunt totul.</b> Aproape orice carte întoarsă ajunge punctată — de tine acum, sau mai târziu printr-o prindere. Prelungește turele, întoarce mult.</li>
<li><b>Ai grijă la 5-uri.</b> Găsește-le devreme (deschiderea face asta), păstrează-ți cărți sigure pentru tura de 5 și nu întoarce cu 5-ul din mână lângă un posibil 5.</li>
<li><b>Găsește Regele devreme.</b> O tură ieftină sacrificată îți garantează +100.</li>
</ul>
<p class="muted">Modul Antrenament îți oferă table simulate la nesfârșit — exersează înainte să consumi King Decks reale.</p>
`,
};
