// Eingebaute Lebensmittel (Richtwerte pro 100 g, nach gaengigen Naehrwerttabellen, koennen leicht abweichen).
// Spalten: Name | kcal | Eiweiss | Kohlenhydrate | Fett | davon Zucker | ges. Fett | Ballaststoffe | Salz | Portionen (Name=Gramm;...)
const FOOD_RAW = `
# Brot, Getreide, Beilagen
Haferflocken|372|13.5|58.7|7|1.2|1.3|10|0.02|Portion 50 g=50;Esslöffel=10
Müsli ohne Zucker|360|10|62|6|10|1|8|0.1|Portion 60 g=60
Cornflakes|375|7|84|0.9|8|0.2|3|1.5|Portion 40 g=40
Weißbrot / Toast|266|8.5|49|3.3|3.5|0.6|2.5|1.2|Scheibe=30
Vollkornbrot|215|7.5|38|1.5|3|0.3|7|1.1|Scheibe=45
Brötchen|270|9|53|1.5|3|0.3|3|1.3|Brötchen=60
Knäckebrot|340|10|66|1.5|3|0.2|14|1.2|Scheibe=10
Reiswaffel|380|8|81|2.5|0.5|0.5|3|0.1|Stück=9
Wrap (Tortilla)|310|8.5|52|7|3|1.5|3|1.3|Wrap=60
Reis, roh|350|7|77|0.6|0.2|0.2|1.3|0.01|Portion 80 g=80
Reis, gekocht|130|2.7|28|0.3|0.1|0.1|0.4|0.01|Portion=200
Nudeln, roh|350|12|70|1.5|3|0.3|3|0.01|Portion 100 g=100
Nudeln, gekocht|158|5.8|31|0.9|0.6|0.2|1.8|0.01|Portion=250
Kartoffeln, gekocht|71|2|15|0.1|0.8|0|1.7|0.01|Kartoffel=80;Portion=250
Süßkartoffel|86|1.6|20|0.1|4|0|3|0.05|Stück=200
Bratkartoffeln|150|2.5|20|7|0.8|0.8|2|0.4|Portion=250
Pommes frites|280|3.5|36|14|0.3|1.6|3.5|0.5|Portion=150
Quinoa, gekocht|120|4.4|21|1.9|0.9|0.2|2.8|0.01|Portion=180
Couscous, gekocht|112|3.8|23|0.2|0.3|0|1.4|0.01|Portion=200
Bulgur, gekocht|83|3|18.6|0.2|0.1|0|4.5|0.01|Portion=200
# Milch, Eier, Käse
Vollmilch 3,5 %|64|3.4|4.8|3.6|4.8|2.3|0|0.1|Glas=250
Milch 1,5 %|47|3.4|4.9|1.5|4.9|1|0|0.1|Glas=250
Haferdrink|45|1|8|1.5|4|0.2|0.8|0.1|Glas=250
Sojadrink|40|3.3|2.5|1.8|2.5|0.3|0.5|0.1|Glas=250
Naturjoghurt 3,5 %|66|3.5|4.7|3.5|4.7|2.3|0|0.1|Becher=150
Naturjoghurt 1,5 %|47|3.5|4.6|1.5|4.6|1|0|0.1|Becher=150
Skyr|63|11|4|0.2|4|0.1|0|0.1|Becher=150
Magerquark|67|12|4|0.3|4|0.2|0|0.1|Portion=125
Speisequark 20 %|115|11|3.5|5|3.5|3.3|0|0.1|Portion=125
Hüttenkäse|98|12|3|4.3|3|2.7|0|0.7|Portion=100
Frischkäse natur|250|6|3.5|23|3.5|15|0|0.8|Portion=30
Gouda|356|25|0|28|0|18|0|1.8|Scheibe=25
Mozzarella|250|18|1|19|1|13|0|0.6|Kugel=125
Emmentaler|370|28|0|29|0|19|0|0.9|Scheibe=25
Feta|264|14|1.5|21|1.5|15|0|2.8|Portion=50
Parmesan|400|36|0|28|0|18|0|1.8|Esslöffel=10
Ei (Hühnerei)|137|12.5|0.7|9.3|0.7|2.7|0|0.4|Ei M=60
Butter|741|0.7|0.6|82|0.6|52|0|0.02|Portion=10
Whey-Protein-Pulver|400|80|6|6|3|3|0|0.5|Messlöffel=30
# Fleisch, Fisch, vegetarisch
Hähnchenbrust, roh|106|23|0|1.5|0|0.4|0|0.2|Filet=150
Hähnchenbrust, gebraten|150|31|0|3|0|0.8|0|0.3|Portion=150
Putenbrust|105|24|0|1|0|0.3|0|0.2|Portion=150
Rinderhack, gemischt|250|17|0|20|0|8|0|0.2|Portion=125
Rinderhack, mager|176|20|0|10|0|4|0|0.2|Portion=125
Schweineschnitzel, roh|100|21|0|1.5|0|0.6|0|0.2|Schnitzel=150
Kochschinken|107|19|0.5|3|0.5|1|0|2.2|Scheibe=20
Salami|450|20|1|40|1|15|0|4.5|Scheibe=10
Bratwurst|300|13|1|27|1|10|0|2|Stück=130
Lachs|205|20|0|13|0|3|0|0.1|Filet=150
Thunfisch (Dose, im Saft)|110|25|0|1|0|0.3|0|1.1|Dose=130
Garnelen|85|18|0.5|1|0|0.2|0|1|Portion=125
Fischstäbchen|200|12|18|9|1|1|1|1.1|Stück=28
Tofu natur|120|13|1.5|7|0.5|1|1|0.05|Portion=125
Linsen, gekocht|115|9|17|0.5|1|0.1|8|0.01|Portion=200
Kichererbsen (Dose)|120|7|15|2.5|1|0.3|5|0.7|Portion=130
Kidneybohnen (Dose)|100|7|13|0.5|1|0.1|6|0.6|Portion=130
Hummus|230|7|11|17|0.5|2|6|1.3|Portion=50
# Gemüse
Tomate|18|0.9|2.6|0.2|2.6|0|1|0.01|Stück=100
Gurke|12|0.6|1.8|0.2|1.8|0|0.5|0.01|Portion=100
Paprika|28|1|5|0.3|5|0|2|0.01|Stück=150
Karotte|35|1|7|0.2|5|0|3|0.1|Stück=70
Zwiebel|28|1.2|5|0.2|4|0|2|0.01|Stück=80
Brokkoli|34|3.5|2.5|0.4|1.5|0|3|0.03|Portion=200
Spinat|23|2.7|0.6|0.4|0.4|0|2|0.2|Portion=150
Zucchini|19|1.6|2.3|0.4|2|0|1|0.01|Stück=250
Champignons|22|2.7|0.5|0.3|0.5|0|1.5|0.01|Portion=150
Blumenkohl|25|2.5|2.5|0.3|2|0|3|0.02|Portion=200
Eisbergsalat|14|1|2|0.2|2|0|1|0.02|Portion=100
Mais (Dose)|90|3|15|1.5|3|0.2|3|0.5|Portion=100
Erbsen|80|6|11|0.5|4|0.1|5|0.02|Portion=150
Avocado|160|2|1.8|15|0.7|2.1|6.7|0.01|Stück=150
Passierte Tomaten|25|1.3|4|0.2|3.5|0|1|0.1|Packung=500
Ketchup|100|1.5|24|0.1|22|0|0.5|2|Esslöffel=15
# Obst
Banane|90|1.1|20|0.2|17|0.1|1.8|0|Stück=120
Apfel|52|0.3|11|0.2|10|0|2|0|Stück=180
Orange|47|0.9|9|0.2|8|0|2|0|Stück=200
Weintrauben|70|0.7|16|0.2|15|0.1|1|0|Portion=150
Erdbeeren|32|0.7|5.5|0.3|5|0|2|0|Portion=150
Blaubeeren|57|0.7|12|0.3|10|0|2.5|0|Portion=100
Ananas|55|0.5|12|0.1|11|0|1.5|0|Portion=150
Mango|60|0.8|13|0.4|12|0.1|1.8|0|Portion=150
Birne|56|0.4|12|0.3|10|0|3|0|Stück=170
Kiwi|50|1|9|0.5|9|0|3|0|Stück=75
Wassermelone|30|0.6|7|0.2|6|0|0.4|0|Portion=300
Datteln|280|2.5|65|0.4|63|0.1|7|0|Stück=8
# Nüsse, Öl, Süßes, Snacks
Mandeln|575|21|10|50|4|4|12|0.02|Handvoll=30
Walnüsse|650|15|7|63|3|6|7|0.01|Handvoll=30
Erdnüsse, geröstet|600|26|8|50|4|8|8|0.01|Handvoll=30
Erdnussbutter|600|25|12|50|8|10|6|0.8|Esslöffel=15
Cashewkerne|570|18|30|44|6|8|3|0.03|Handvoll=30
Olivenöl|900|0|0|100|0|14|0|0|Esslöffel=10
Rapsöl|900|0|0|100|0|7|0|0|Esslöffel=10
Honig|305|0.4|75|0|75|0|0|0|Teelöffel=7
Zucker|400|0|100|0|100|0|0|0|Teelöffel=4
Nutella|540|6.3|57.5|31|56|10.6|0|0.1|Portion=15
Marmelade|250|0.4|60|0|58|0|1|0|Portion=20
Vollmilchschokolade|540|7|57|31|56|18|1.5|0.2|Riegel=20;Tafel=100
Zartbitterschokolade|550|6|45|35|30|21|9|0|Rippe=10
Kartoffelchips|530|6|50|33|1|3|4|1.3|Portion=30
Gummibärchen|340|6.5|77|0.1|46|0|0|0|Portion=30
Müsliriegel|400|6|65|13|30|5|5|0.3|Riegel=25
Butterkeks|450|7|72|15|20|8|2|0.8|Keks=8
Proteinriegel|370|33|35|10|3|5|8|0.5|Riegel=45
# Getränke
Cola|42|0|10.6|0|10.6|0|0|0|Glas=250;Dose=330
Apfelsaft|46|0.1|11|0.1|10|0|0|0|Glas=250
Orangensaft|45|0.7|10|0.2|9|0|0|0|Glas=250
Bier|43|0.4|3.6|0|0|0|0|0|Flasche=500
Wein|70|0.1|2|0|1|0|0|0|Glas=150
Energydrink|45|0|11|0|11|0|0|0.1|Dose=250
Kaffee mit Milch|20|1|2|0.8|2|0.5|0|0|Tasse=200
# Gerichte (typische Portionen)
Spaghetti Bolognese|135|7|15|5|3|2|1.5|0.6|Portion=400
Lasagne|150|8|13|7|3|3.5|1|0.7|Portion=350
Pizza Margherita|250|11|31|9|3|4|2|1.3|Pizza=350
Döner im Fladenbrot|215|12|20|9|3|3|2|1.2|Döner=350
Cheeseburger|250|13|25|11|5|5|1.5|1.6|Burger=200
Schnitzel, paniert|230|17|11|13|0.5|3|1|1|Schnitzel=180
Gulasch|150|12|4|9|2|3|1|0.8|Portion=300
Chili con Carne|120|9|9|5|2|2|3|0.8|Portion=350
Linsensuppe|70|4.5|9|1.5|2|0.5|3|0.8|Teller=400
Gemüsesuppe|30|1|5|0.5|2|0|1.5|0.7|Teller=350
Reispfanne mit Hähnchen|125|9|14|3|2|0.8|1.5|0.7|Portion=400
Rührei|170|11|1.5|13|1|4|0|0.8|2 Eier=130
Pfannkuchen|190|6|28|6|7|2|1|0.3|Stück=80
Haferbrei (mit Milch)|100|4|14|3|4|1.5|1.5|0.1|Portion=300
Wrap mit Hähnchen|190|11|22|6|3|1.5|2|1|Wrap=250
Wrap mit Hackfleisch|210|11|20|9|3|3|2|1|Wrap=250
Kartoffelsalat|130|2|15|7|2|1|1.5|0.8|Portion=200
Gemüsepfanne|70|2|8|3|4|0.5|3|0.5|Portion=300
Nudelsalat|160|4|20|7|3|1|2|0.9|Portion=250
Curry mit Reis|140|7|18|4|3|2|2|0.7|Portion=450
`;

const FOODS = [];
(function parseFoods() {
  let cat = '';
  FOOD_RAW.split('\n').forEach((line) => {
    line = line.trim();
    if (!line) return;
    if (line[0] === '#') { cat = line.slice(1).trim(); return; }
    const p = line.split('|');
    const portions = (p[9] || '').split(';').filter(Boolean).map((x) => { const [n, g] = x.split('='); return { n, g: +g }; });
    FOODS.push({ id: 'b' + FOODS.length, name: p[0], cat, k: +p[1], p: +p[2], c: +p[3], f: +p[4], s: +p[5], sf: +p[6], fi: +p[7], sa: +p[8], portions, src: 'db' });
  });
})();

// Uebungsbibliothek: Name | Muskelgruppe
const EXERCISE_RAW = `
Brust|Bankdrücken;Schrägbankdrücken (Langhantel);Schrägbankdrücken (Kurzhantel);Flachbankdrücken (Kurzhantel);Negativbankdrücken;Fliegende (Kurzhantel);Fliegende (Kabel);Cable Crossover;Butterfly (Maschine);Brustpresse (Maschine);Dips (Brust);Liegestütze;Pullover
Rücken|Latzug;Latzug eng;Klimmzüge;Klimmzüge (Untergriff);Rudern vorgebeugt;Rudern (Kurzhantel);Kabelrudern;Rudern (T-Bar);Rudern (Maschine);Kreuzheben;Rückenstrecker;Face Pulls;Shrugs;Straight-Arm Pulldown
Schultern|Schulterdrücken (Langhantel);Schulterdrücken (Kurzhantel);Schulterdrücken (Maschine);Seitheben;Seitheben (Kabel);Frontheben;Reverse Fly (Kurzhantel);Reverse Butterfly;Arnold Press;Aufrechtes Rudern
Bizeps|Bizeps-Curls (Kurzhantel);Bizeps-Curls (Langhantel);SZ-Stange Curls;Hammer-Curls;Konzentrationscurls;Scott-Curls;Kabelcurls;Preacher Curls
Trizeps|Trizepsdrücken (Kabel);Trizepsdrücken (Seil);Overhead-Trizeps (Kurzhantel);Overhead-Trizeps (Kabel);Stirndrücken;Dips (Trizeps);Enges Bankdrücken;Kickbacks
Beine|Kniebeugen;Frontkniebeugen;Beinpresse;Ausfallschritte;Bulgarian Split Squats;Rumänisches Kreuzheben;Beinstrecker;Beinbeuger (liegend);Beinbeuger (sitzend);Wadenheben (stehend);Wadenheben (sitzend);Hip Thrusts;Goblet Squats;Abduktoren;Adduktoren
Rumpf|Plank;Seitlicher Plank;Crunches;Beinheben (hängend);Cable Crunches;Russian Twists;Ab-Wheel;Bergsteiger;Hyperextensions
Ganzkörper|Kreuzheben (konventionell);Kettlebell Swings;Clean and Press;Farmer's Walk;Burpees;Thruster
`;
const EXERCISES = [];
EXERCISE_RAW.trim().split('\n').forEach((line) => {
  const [group, list] = line.split('|');
  list.split(';').forEach((n) => EXERCISES.push({ name: n, group }));
});
