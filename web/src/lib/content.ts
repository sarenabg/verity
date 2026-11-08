// The encyclopedia's starting content.
//
// An article is a list of paragraphs. Each paragraph mixes plain text with
// facts. Every fact has a market, and three written versions: what the page
// says when the market thinks it's true (70%+), disputed (30–70%) or false
// (under 30%). The AI writer (lib/writer.ts, or NEAR AI when a key is set)
// picks or rewrites the sentence from the market's current price.

export type Source = { title: string; url: string };

export type Claim = {
  id: string;
  article: string;
  /** The market's question, shown on the betting card. */
  question: string;
  yes: string;
  mixed: string;
  no: string;
  /** Starting True price. */
  start: number;
  /** How much money it takes to move the price (pool depth). */
  depth: number;
  /** Seeded activity numbers, so the demo doesn't start empty. */
  traders: number;
  volume: number;
  /**
   * Can an AI judge settle this today, from public evidence?
   * `truth` is what the demo judge rules (the live judge decides for itself).
   */
  checkable: boolean;
  truth?: boolean;
  /** One or two sentences of evidence the demo judge cites. */
  evidence: string;
  sources: Source[];
};

export type Segment = string | { claim: string };

export type Article = {
  slug: string;
  title: string;
  topic: string;
  /** Short line under the title on cards. */
  blurb: string;
  /** Background tint for the article's card on the home page. */
  tint: string;
  /** The fact whose market opens first. */
  featured: string;
  paragraphs: Segment[][];
};

const wiki = (page: string): Source => ({ title: `Wikipedia: ${page.replace(/_/g, " ")}`, url: `https://en.wikipedia.org/wiki/${page}` });

export const CLAIMS: Claim[] = [
  // ---------------- Mount Everest ----------------
  {
    id: "everest-height",
    article: "mount-everest",
    question: "Is Everest the highest mountain above sea level?",
    yes: "Mount Everest is the highest mountain above sea level, at 8,848.86 metres.",
    mixed: "Mount Everest is usually listed as the highest mountain above sea level, at 8,848.86 metres, though some question the measurement.",
    no: "Despite its fame, Mount Everest may not be the highest mountain above sea level.",
    start: 0.99,
    depth: 40000,
    traders: 1240,
    volume: 61200,
    checkable: true,
    truth: true,
    evidence: "A joint China–Nepal survey in 2020 measured the summit at 8,848.86 m above sea level. No other mountain comes close.",
    sources: [wiki("Mount_Everest")],
  },
  {
    id: "everest-rising",
    article: "mount-everest",
    question: "Is Everest still getting taller?",
    yes: "It is still rising by a few millimetres each year, pushed up as India grinds into Asia.",
    mixed: "It may still be rising by a few millimetres each year, though measurements disagree.",
    no: "Contrary to popular belief, it is not measurably growing taller.",
    start: 0.76,
    depth: 1200,
    traders: 188,
    volume: 4310,
    checkable: true,
    truth: true,
    evidence: "GPS stations on and around the mountain record steady uplift of a few millimetres a year, driven by the India–Asia plate collision.",
    sources: [wiki("Mount_Everest"), wiki("Geology_of_the_Himalayas")],
  },
  {
    id: "everest-mauna-kea",
    article: "mount-everest",
    question: "Is Mauna Kea taller than Everest from base to peak?",
    yes: "Measured from base to peak it is not the tallest: Mauna Kea in Hawaii rises over 10,000 metres from the ocean floor.",
    mixed: "Some argue Mauna Kea in Hawaii is taller when measured from the ocean floor.",
    no: "It is also the tallest mountain from base to peak, ahead of rivals such as Mauna Kea.",
    start: 0.91,
    depth: 6000,
    traders: 402,
    volume: 9870,
    checkable: true,
    truth: true,
    evidence: "Mauna Kea's base sits about 6,000 m below sea level, so it measures about 10,200 m from base to peak, more than Everest's height above its base.",
    sources: [wiki("Mauna_Kea")],
  },
  {
    id: "everest-first",
    article: "mount-everest",
    question: "Were Hillary and Norgay the first to reach the top?",
    yes: "Edmund Hillary and Tenzing Norgay were the first people to reach the summit, on 29 May 1953.",
    mixed: "Edmund Hillary and Tenzing Norgay are usually credited as the first to reach the summit, on 29 May 1953, though this is debated.",
    no: "Edmund Hillary and Tenzing Norgay, long credited with the first ascent in 1953, were probably not the first to stand on the summit.",
    start: 0.86,
    depth: 3000,
    traders: 655,
    volume: 15420,
    checkable: false,
    evidence: "The 1953 ascent is fully documented. Whether anyone got there earlier depends on the unsolved 1924 Mallory and Irvine question.",
    sources: [wiki("1953_British_Mount_Everest_expedition")],
  },
  {
    id: "everest-mallory",
    article: "mount-everest",
    question: "Did George Mallory reach the top in 1924?",
    yes: "George Mallory and Andrew Irvine most likely reached the summit first, in 1924, before dying on the way down.",
    mixed: "Whether George Mallory and Andrew Irvine reached the summit in 1924, before dying on the way down, is still an open question.",
    no: "A popular theory says George Mallory and Andrew Irvine got there first in 1924, but little evidence supports it.",
    start: 0.14,
    depth: 800,
    traders: 412,
    volume: 9870,
    checkable: false,
    evidence: "Mallory's body was found in 1999 without the photo of his wife he planned to leave on top, which some read as a sign he got there. No camera or photo from the summit has been found.",
    sources: [wiki("George_Mallory"), wiki("1924_British_Mount_Everest_expedition")],
  },

  // ---------------- Pluto ----------------
  {
    id: "pluto-planet",
    article: "pluto",
    question: "Is Pluto a planet?",
    yes: "Pluto is a planet, the ninth in our solar system.",
    mixed: "Whether Pluto counts as a planet is still argued over: astronomers reclassified it as a dwarf planet in 2006, but many planetary scientists disagree.",
    no: "Pluto is not a planet: since 2006, astronomers have classed it as a dwarf planet.",
    start: 0.31,
    depth: 900,
    traders: 2210,
    volume: 38400,
    checkable: false,
    evidence: "The International Astronomical Union's 2006 definition excludes Pluto, but the definition itself is disputed, so the answer depends on which definition you use.",
    sources: [wiki("Pluto"), wiki("IAU_definition_of_planet")],
  },
  {
    id: "pluto-heart",
    article: "pluto",
    question: "Does Pluto have a giant heart-shaped region?",
    yes: "Its surface has a huge heart-shaped region, Tombaugh Regio, first photographed by NASA's New Horizons probe in 2015.",
    mixed: "New Horizons photographed what some describe as a heart-shaped region, Tombaugh Regio, on its surface.",
    no: "The famous 'heart' on its surface turned out to be a trick of early, blurry images.",
    start: 0.99,
    depth: 30000,
    traders: 520,
    volume: 7600,
    checkable: true,
    truth: true,
    evidence: "New Horizons imaged Tombaugh Regio in detail during its July 2015 flyby; its western lobe is a nitrogen-ice plain called Sputnik Planitia.",
    sources: [wiki("Tombaugh_Regio")],
  },
  {
    id: "pluto-ocean",
    article: "pluto",
    question: "Is there a liquid ocean under Pluto's ice?",
    yes: "Beneath its icy crust there is very likely a liquid water ocean.",
    mixed: "Scientists suspect, but have not confirmed, that a liquid ocean lies beneath its icy crust.",
    no: "Its interior is thought to be frozen solid, with no hidden ocean.",
    start: 0.63,
    depth: 900,
    traders: 341,
    volume: 6120,
    checkable: false,
    evidence: "The position of Sputnik Planitia and cracks on the surface point to an ocean, but no probe has measured it directly.",
    sources: [wiki("Pluto"), wiki("Sputnik_Planitia")],
  },
  {
    id: "pluto-moons",
    article: "pluto",
    question: "Does Pluto have five known moons?",
    yes: "It has five known moons; the largest, Charon, is about half Pluto's width.",
    mixed: "It has at least five moons, though counts have changed as telescopes improved; the largest, Charon, is about half Pluto's width.",
    no: "Apart from Charon, its so-called moons are probably just passing debris.",
    start: 0.97,
    depth: 12000,
    traders: 230,
    volume: 3010,
    checkable: true,
    truth: true,
    evidence: "Charon, Nix, Hydra, Kerberos and Styx are confirmed. Charon is about 1,212 km across; Pluto is about 2,377 km.",
    sources: [wiki("Moons_of_Pluto")],
  },

  // ---------------- Octopus ----------------
  {
    id: "octopus-hearts",
    article: "octopus",
    question: "Does an octopus have three hearts?",
    yes: "An octopus has three hearts and blue blood.",
    mixed: "An octopus is often said to have three hearts and blue blood.",
    no: "The popular claim that an octopus has three hearts is a myth.",
    start: 0.98,
    depth: 20000,
    traders: 870,
    volume: 11900,
    checkable: true,
    truth: true,
    evidence: "Two branchial hearts pump blood through the gills and one systemic heart pumps it round the body. The blood is blue because it carries oxygen with copper-based hemocyanin.",
    sources: [wiki("Octopus")],
  },
  {
    id: "octopus-arms",
    article: "octopus",
    question: "Are most of an octopus's neurons in its arms?",
    yes: "About two thirds of its neurons are in its arms, not its brain.",
    mixed: "A large share of its neurons, perhaps most, are in its arms rather than its brain.",
    no: "Like other animals, it keeps most of its neurons in its brain.",
    start: 0.88,
    depth: 5000,
    traders: 290,
    volume: 4400,
    checkable: true,
    truth: true,
    evidence: "Of roughly 500 million neurons in a common octopus, about 350 million are in the arms.",
    sources: [wiki("Octopus"), wiki("Cephalopod_intelligence")],
  },
  {
    id: "octopus-taste",
    article: "octopus",
    question: "Can an octopus taste with its arms?",
    yes: "It tastes what it touches, using receptors in its suckers.",
    mixed: "It may be able to taste what it touches, using receptors in its suckers.",
    no: "Despite the myth, its suckers only feel, and cannot taste.",
    start: 0.93,
    depth: 8000,
    traders: 310,
    volume: 5200,
    checkable: true,
    truth: true,
    evidence: "A 2020 study in the journal Cell identified chemotactile receptors in octopus suckers that let them 'taste by touch'.",
    sources: [wiki("Octopus")],
  },
  {
    id: "octopus-dream",
    article: "octopus",
    question: "Do octopuses dream?",
    yes: "Octopuses appear to dream: during 'active sleep' their skin flashes through colour patterns, much like REM sleep in humans.",
    mixed: "Some scientists think octopuses may dream, pointing to colour flashes during 'active sleep', but this is unproven.",
    no: "Octopuses change colour while asleep, but there is no good evidence that they dream.",
    start: 0.46,
    depth: 800,
    traders: 615,
    volume: 8760,
    checkable: false,
    evidence: "Researchers have recorded an 'active sleep' phase with skin and eye movements, but nobody can yet tell what, if anything, an octopus experiences.",
    sources: [wiki("Octopus")],
  },
  {
    id: "octopus-lifespan",
    article: "octopus",
    question: "Do most octopuses live only one to two years?",
    yes: "Most species live only one to two years.",
    mixed: "Many species live only one to two years, though some large ones live longer.",
    no: "They are long-lived animals, often living for decades.",
    start: 0.85,
    depth: 4000,
    traders: 140,
    volume: 1980,
    checkable: true,
    truth: true,
    evidence: "Most octopus species live 1–2 years; the giant Pacific octopus, one of the longest-lived, reaches about 3–5.",
    sources: [wiki("Octopus")],
  },

  // ---------------- Great Wall of China ----------------
  {
    id: "wall-space",
    article: "great-wall-of-china",
    question: "Can you see the Great Wall from space with the naked eye?",
    yes: "It is famously visible from space with the naked eye.",
    mixed: "Whether it can be seen from space with the naked eye is disputed; astronauts' accounts differ.",
    no: "Contrary to a popular myth, it cannot be seen from space with the naked eye: it is long, but only a few metres wide.",
    start: 0.06,
    depth: 3000,
    traders: 1830,
    volume: 27400,
    checkable: true,
    truth: false,
    evidence: "China's first astronaut, Yang Liwei, said in 2003 that he could not see it. The wall is about 5–8 m wide and close in colour to the ground around it.",
    sources: [wiki("Great_Wall_of_China")],
  },
  {
    id: "wall-length",
    article: "great-wall-of-china",
    question: "Is the Great Wall about 21,000 km long, counting every branch?",
    yes: "A 2012 survey measured all of its branches at 21,196 kilometres in total.",
    mixed: "A 2012 survey put the length of all its branches at 21,196 kilometres, though estimates vary widely.",
    no: "Its true length is far shorter than the often-quoted 21,000 kilometres.",
    start: 0.94,
    depth: 9000,
    traders: 260,
    volume: 3900,
    checkable: true,
    truth: true,
    evidence: "China's State Administration of Cultural Heritage announced 21,196.18 km in 2012, after a five-year survey.",
    sources: [wiki("Great_Wall_of_China")],
  },
  {
    id: "wall-ming",
    article: "great-wall-of-china",
    question: "Was most of today's visible wall built by the Ming dynasty?",
    yes: "Most of what visitors see today was built during the Ming dynasty (1368–1644).",
    mixed: "Much of what visitors see today is thought to date from the Ming dynasty (1368–1644).",
    no: "Most of what visitors see today is more than 2,000 years old.",
    start: 0.92,
    depth: 8000,
    traders: 220,
    volume: 3100,
    checkable: true,
    truth: true,
    evidence: "The best-preserved and most-visited stone and brick sections, such as Badaling and Mutianyu, were built or rebuilt under the Ming.",
    sources: [wiki("Ming_Great_Wall")],
  },
  {
    id: "wall-rice",
    article: "great-wall-of-china",
    question: "Was sticky rice used in the wall's mortar?",
    yes: "Builders mixed sticky rice into the lime mortar, which made it unusually strong.",
    mixed: "Builders may have mixed sticky rice into the lime mortar of some sections.",
    no: "The story that builders used sticky rice in the mortar is a legend.",
    start: 0.78,
    depth: 1500,
    traders: 330,
    volume: 5050,
    checkable: true,
    truth: true,
    evidence: "A 2010 chemistry study found amylopectin, a starch from sticky rice, in Ming-era lime mortar, including in parts of the wall.",
    sources: [wiki("Great_Wall_of_China")],
  },
  {
    id: "wall-bodies",
    article: "great-wall-of-china",
    question: "Are workers who died building it buried inside the wall?",
    yes: "Many workers who died building it were buried inside the wall itself.",
    mixed: "Legends say workers who died were buried inside the wall; archaeologists have found little to confirm it.",
    no: "The legend that dead workers were buried inside the wall is not supported by archaeology.",
    start: 0.22,
    depth: 1000,
    traders: 480,
    volume: 6700,
    checkable: false,
    evidence: "Many workers did die, and graves have been found near the wall, but no human remains have been found built into it. Absence of evidence is not proof.",
    sources: [wiki("Great_Wall_of_China")],
  },

  // ---------------- Voynich manuscript ----------------
  {
    id: "voynich-date",
    article: "voynich-manuscript",
    question: "Does the Voynich manuscript's vellum date to 1404–1438?",
    yes: "Its vellum has been carbon-dated to the early 15th century, between 1404 and 1438.",
    mixed: "Its vellum has been carbon-dated to the early 15th century, though the ink could be later.",
    no: "Despite its old look, it is probably a modern forgery.",
    start: 0.95,
    depth: 10000,
    traders: 310,
    volume: 4800,
    checkable: true,
    truth: true,
    evidence: "University of Arizona radiocarbon tests in 2009 dated the vellum to 1404–1438.",
    sources: [wiki("Voynich_manuscript")],
  },
  {
    id: "voynich-decoded",
    article: "voynich-manuscript",
    question: "Has the Voynich manuscript been deciphered?",
    yes: "Its text has been deciphered.",
    mixed: "Several researchers claim to have deciphered it, but none of their readings is widely accepted.",
    no: "Despite many claims, its text has never been convincingly deciphered.",
    start: 0.05,
    depth: 3000,
    traders: 940,
    volume: 12800,
    checkable: true,
    truth: false,
    evidence: "Many decipherments have been announced, from the 1920s to the 2010s. None has been accepted by specialists, and none can translate new pages reliably.",
    sources: [wiki("Voynich_manuscript")],
  },
  {
    id: "voynich-language",
    article: "voynich-manuscript",
    question: "Does the Voynich text encode a real language?",
    yes: "Statistical studies suggest the text encodes a real language.",
    mixed: "Whether the text encodes a real language or is an elaborate hoax is still debated.",
    no: "The text is most likely meaningless, perhaps an elaborate hoax.",
    start: 0.52,
    depth: 800,
    traders: 720,
    volume: 9900,
    checkable: false,
    evidence: "Word frequencies follow patterns seen in natural languages, but researchers have also produced similar-looking text with simple tables and grilles.",
    sources: [wiki("Voynich_manuscript")],
  },
  {
    id: "voynich-yale",
    article: "voynich-manuscript",
    question: "Is the manuscript kept at Yale's Beinecke Library?",
    yes: "It is kept at Yale University's Beinecke Rare Book and Manuscript Library.",
    mixed: "It is believed to be kept at Yale University's Beinecke Rare Book and Manuscript Library.",
    no: "Its current location is unknown.",
    start: 0.99,
    depth: 30000,
    traders: 90,
    volume: 1100,
    checkable: true,
    truth: true,
    evidence: "It is catalogued as Beinecke MS 408 and has been at Yale since 1969.",
    sources: [wiki("Voynich_manuscript")],
  },

  // ---------------- Napoleon ----------------
  {
    id: "napoleon-short",
    article: "napoleon",
    question: "Was Napoleon unusually short?",
    yes: "He was famously short for his time.",
    mixed: "Whether he was short for his time is disputed, partly because French and English inches differed.",
    no: "Despite his reputation, he was about 1.69 m (5 ft 7 in), average for a Frenchman of his time.",
    start: 0.09,
    depth: 2500,
    traders: 1320,
    volume: 19400,
    checkable: true,
    truth: false,
    evidence: "His height was recorded as 5 feet 2 French inches, about 1.69 m. The myth comes partly from confusing French and English inches, and from British cartoons.",
    sources: [wiki("Napoleon")],
  },
  {
    id: "napoleon-corsica",
    article: "napoleon",
    question: "Was Napoleon born in Corsica in 1769?",
    yes: "He was born in Ajaccio, on the island of Corsica, in 1769.",
    mixed: "He was born in Ajaccio, Corsica, probably in 1769.",
    no: "Contrary to the usual story, he was not born on Corsica.",
    start: 0.99,
    depth: 30000,
    traders: 150,
    volume: 1900,
    checkable: true,
    truth: true,
    evidence: "He was born in Ajaccio on 15 August 1769, a year after France took control of Corsica.",
    sources: [wiki("Napoleon")],
  },
  {
    id: "napoleon-code",
    article: "napoleon",
    question: "Does the Napoleonic Code still shape law today?",
    yes: "His civil code, the Napoleonic Code, still shapes the law of many countries today.",
    mixed: "His civil code, the Napoleonic Code, is said to still influence the law of some countries.",
    no: "His civil code, the Napoleonic Code, has little influence on law today.",
    start: 0.95,
    depth: 10000,
    traders: 180,
    volume: 2600,
    checkable: true,
    truth: true,
    evidence: "The 1804 Civil Code remains the basis of French civil law and influenced codes across Europe, Latin America and beyond.",
    sources: [wiki("Napoleonic_Code")],
  },
  {
    id: "napoleon-death",
    article: "napoleon",
    question: "Did Napoleon die of stomach cancer?",
    yes: "He died in exile on Saint Helena in 1821, most likely of stomach cancer.",
    mixed: "He died in exile on Saint Helena in 1821; the cause is debated, with stomach cancer and arsenic poisoning both suggested.",
    no: "He died in exile on Saint Helena in 1821, probably poisoned with arsenic rather than of natural causes.",
    start: 0.72,
    depth: 900,
    traders: 860,
    volume: 12300,
    checkable: false,
    evidence: "His autopsy found a large stomach ulcer and signs of cancer. Arsenic was later found in his hair, but also in hair samples from his childhood and his family.",
    sources: [wiki("Death_of_Napoleon")],
  },
];

export const ARTICLES: Article[] = [
  {
    slug: "mount-everest",
    title: "Mount Everest",
    topic: "Mountains",
    blurb: "Who really stood on top first?",
    tint: "#E8EEF8",
    featured: "everest-mallory",
    paragraphs: [
      [{ claim: "everest-height" }, " It sits on the border between Nepal and China, in the Himalayas. ", { claim: "everest-rising" }],
      [{ claim: "everest-mauna-kea" }],
      [{ claim: "everest-first" }, " ", { claim: "everest-mallory" }, " Mallory's body was found in 1999; remains believed to be Irvine's were found in 2024."],
    ],
  },
  {
    slug: "pluto",
    title: "Pluto",
    topic: "Space",
    blurb: "Planet, dwarf planet, or something else?",
    tint: "#EFEAF6",
    featured: "pluto-planet",
    paragraphs: [
      ["Pluto was discovered by Clyde Tombaugh in 1930 and orbits the Sun far beyond Neptune. ", { claim: "pluto-planet" }],
      [{ claim: "pluto-heart" }, " ", { claim: "pluto-ocean" }],
      [{ claim: "pluto-moons" }],
    ],
  },
  {
    slug: "octopus",
    title: "Octopus",
    topic: "Animals",
    blurb: "Three hearts, nine brains, and maybe dreams.",
    tint: "#F8ECE6",
    featured: "octopus-dream",
    paragraphs: [
      ["Octopuses are soft-bodied animals with eight arms, related to squid and cuttlefish. ", { claim: "octopus-hearts" }],
      [{ claim: "octopus-arms" }, " ", { claim: "octopus-taste" }],
      [{ claim: "octopus-dream" }, " ", { claim: "octopus-lifespan" }],
    ],
  },
  {
    slug: "great-wall-of-china",
    title: "Great Wall of China",
    topic: "History",
    blurb: "The myth you learned at school.",
    tint: "#F3EEDF",
    featured: "wall-space",
    paragraphs: [
      ["The Great Wall is a series of walls and forts built across northern China over some 2,000 years. ", { claim: "wall-length" }, " ", { claim: "wall-ming" }],
      [{ claim: "wall-space" }],
      [{ claim: "wall-rice" }, " ", { claim: "wall-bodies" }],
    ],
  },
  {
    slug: "voynich-manuscript",
    title: "Voynich manuscript",
    topic: "Mysteries",
    blurb: "The book nobody can read.",
    tint: "#E9F1EA",
    featured: "voynich-language",
    paragraphs: [
      ["The Voynich manuscript is an illustrated book written in an unknown script, named after Wilfrid Voynich, the book dealer who bought it in 1912. ", { claim: "voynich-date" }],
      [{ claim: "voynich-decoded" }, " ", { claim: "voynich-language" }],
      [{ claim: "voynich-yale" }],
    ],
  },
  {
    slug: "napoleon",
    title: "Napoleon",
    topic: "History",
    blurb: "Short? Poisoned? Let the market decide.",
    tint: "#F6E9EA",
    featured: "napoleon-death",
    paragraphs: [
      ["Napoleon Bonaparte was a French military leader who crowned himself Emperor of the French in 1804. ", { claim: "napoleon-corsica" }, " ", { claim: "napoleon-short" }],
      [{ claim: "napoleon-code" }],
      ["He was finally defeated at Waterloo in 1815. ", { claim: "napoleon-death" }],
    ],
  },
];

export const CLAIM_BY_ID: Record<string, Claim> = Object.fromEntries(CLAIMS.map((c) => [c.id, c]));
export const ARTICLE_BY_SLUG: Record<string, Article> = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));

export function claimsOf(slug: string): Claim[] {
  return CLAIMS.filter((c) => c.article === slug);
}
