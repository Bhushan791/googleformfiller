/**
 * Rich, comprehensive custom hardcoded responses used when LLM providers are unavailable or fail.
 * Guaranteed realistic, natural, varied answers for all sentiments and categories.
 */

export const HARDCODED_SHORT_TEXT = {
  positive: [
    "Very good experience overall.",
    "Exceeded my expectations in every way.",
    "Quick, intuitive, and responsive support.",
    "Highly satisfied with the quality.",
    "Smooth, simple, and straightforward.",
    "Great communication throughout the process.",
    "Everything worked seamlessly from day one.",
    "Would definitely recommend to peers.",
    "Clear instructions and pleasant interaction.",
    "Fast turnaround and excellent delivery.",
    "Very impressed with the thoughtful details.",
    "User-friendly and well-organized.",
    "Dependable and high quality service.",
    "Saved our team a significant amount of time.",
    "Fantastic attention to detail.",
    "The overall flow was effortless.",
    "Super clean execution and friendly follow-up.",
    "Prompt, professional, and reliable.",
    "Exactly what I was looking for.",
    "A wonderful experience from start to finish.",
    "Reliable and well thought out.",
    "Very practical and easy to use.",
    "High standard of performance throughout.",
    "Helpful guidance whenever needed.",
    "Positive impression from the beginning.",
  ],
  neutral: [
    "Average experience overall.",
    "Met the basic expectations.",
    "Standard service provided as described.",
    "Nothing particularly notable to highlight.",
    "Acceptable performance, but room for improvement.",
    "Fair value for the required effort.",
    "As expected, neither outstanding nor poor.",
    "Moderate satisfaction with the result.",
    "Worked fine for everyday basic needs.",
    "Some steps were clear, others could be streamlined.",
    "Adequate for current requirements.",
    "No major complaints, but nothing exceptional.",
    "Straightforward enough once familiar with it.",
    "Meets the minimum criteria satisfactorily.",
    "Standard workflow with conventional options.",
    "Decent functionality overall.",
    "Functional and does what it is supposed to do.",
    "Reasonable turnaround time for standard tasks.",
    "Fairly consistent with similar services.",
    "Neither impressed nor dissatisfied.",
    "Usable for standard use cases.",
    "Satisfactory, though a bit plain.",
    "Routine experience with typical outcomes.",
    "Acceptable execution with minor rough edges.",
    "Average quality consistent with expectations.",
  ],
  negative: [
    "Did not meet expectations.",
    "Encountered multiple confusing issues along the way.",
    "Slow response times and unclear feedback.",
    "Disappointed with the overall quality.",
    "Needs significant refinement and polishing.",
    "Frustrating and difficult to navigate comfortably.",
    "Lacked clear instructions and guidance.",
    "Would not choose this option again without fixes.",
    "Felt disorganized and cumbersome.",
    "Expected a smoother process than what occurred.",
    "Too many unexpected friction points.",
    "Communication could be substantially improved.",
    "Felt unintuitive and required too much effort.",
    "Inconsistent results during testing.",
    "Turnaround time was slower than promised.",
    "Encountered several minor glitches.",
    "Documentation was vague and incomplete.",
    "Needs better error handling and clearer alerts.",
    "Not user-friendly for newcomers.",
    "Fell short of our team's standards.",
    "Disappointed by the lack of responsiveness.",
    "The workflow felt convoluted and unpolished.",
    "Requires too much manual intervention.",
    "Too rigid and lacking flexibility.",
    "Substantial improvements are required.",
  ],
};

export const HARDCODED_PARAGRAPHS = {
  positive: [
    "Overall, I had a very positive experience. Everything was delivered on time and the instructions were clear and helpful. I would happily recommend this to colleagues and friends.",
    "The process was intuitive and well organized from start to finish. Any questions I had were answered promptly, making the entire workflow enjoyable and stress-free.",
    "I was genuinely impressed by how smooth the process felt. The quality exceeded my initial expectations and saved me significant time compared to traditional alternatives.",
    "Clear communication, swift responses, and a polished presentation made all the difference. The team clearly cares about user satisfaction and delivers on its promises.",
    "A remarkably seamless workflow. Features were right where I expected them to be, and the overall experience was both productive and pleasant.",
    "I appreciate the thoroughness and attention to detail. Every step felt intentional, and the results met all of our project requirements with flying colors.",
    "From the initial interaction through completion, everything ran like clockwork. I am confident in continuing to use and recommend this service going forward.",
    "The clarity of instructions and the quality of output were both top-tier. It is rare to find an experience that just works without unnecessary friction.",
  ],
  neutral: [
    "My experience was fairly standard. Most aspects worked as advertised, although there are a few minor areas that could use refinement. It serves its core purpose adequately for everyday tasks.",
    "The process was reasonable and straightforward enough for basic needs. It did not stand out as exceptional, but it met the minimum requirements without significant delays.",
    "An average workflow overall. Some parts were smooth while others took slightly longer than expected, but the end result was acceptable and aligned with expectations.",
    "Functionally sound with a conventional design. While it could benefit from faster response times and updated guidelines, it accomplished what was needed without major issues.",
    "The experience was neither particularly memorable nor problematic. It delivered standard outcomes within an acceptable timeframe for routine work.",
    "Decent overall. A few steps felt slightly redundant, but the core functionality operated reliably enough to complete the objectives.",
  ],
  negative: [
    "I ran into multiple hurdles during the process. The instructions were ambiguous and several unexpected delays occurred along the way. Substantial polish is needed before this can be considered reliable.",
    "Unfortunately, this fell well below my expectations. The user experience felt clunky and resolving basic issues took far more effort than it should have for a standard task.",
    "The overall experience was frustrating. Communication was lacking, error messages provided little useful context, and the turnaround time was unacceptable for our team's requirements.",
    "Navigating the workflow required constant guesswork. Key steps were poorly documented, leading to confusion and wasted time trying to clarify basic details.",
    "Several friction points made this a disappointing experience. The interface lacked consistency and basic actions failed without helpful explanations.",
    "I had hoped for a streamlined solution, but instead encountered multiple stumbling blocks that slowed down our entire workflow.",
  ],
};

/**
 * Returns a hardcoded response matching question type and sentiment.
 */
export function getCustomHardcodedAnswer(type, sentiment = "neutral") {
  const isParagraph = type === "paragraph";
  const source = isParagraph ? HARDCODED_PARAGRAPHS : HARDCODED_SHORT_TEXT;
  const pool = source[sentiment] || source.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Smart heuristic option classification for choice/checkbox questions when LLM is down.
 */
export function classifyOptionHeuristic(optionText = "") {
  const lower = String(optionText).toLowerCase().trim();

  // Strongly positive
  if (
    /^(yes|true|agree|strongly agree|definitely|always|frequently|very satisfied|satisfied|excellent|great|good|high|daily|weekly|recommended)$/.test(lower) ||
    /\b(excellent|outstanding|satisfied|love|best|easy)\b/.test(lower)
  ) {
    return "positive";
  }

  // Strongly negative
  if (
    /^(no|false|disagree|strongly disagree|never|rarely|unsatisfied|very unsatisfied|poor|terrible|bad|low|unlikely|not recommended)$/.test(lower) ||
    /\b(poor|bad|difficult|hate|worst|fail)\b/.test(lower)
  ) {
    return "negative";
  }

  // Neutral / neutral-adjacent
  if (
    /^(neutral|neither|somewhat|average|moderate|sometimes|monthly|maybe|unsure|n\/a|other)$/.test(lower) ||
    /\b(average|fair|okay|moderate)\b/.test(lower)
  ) {
    return "neutral";
  }

  return "n/a";
}

