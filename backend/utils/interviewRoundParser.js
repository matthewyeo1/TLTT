function parseInterviewRound(subject, snippet, sender) {
  const text = `${subject} ${snippet}`.toLowerCase();
  
  // Pattern matching for round numbers
  const roundPatterns = [
    { pattern: /round\s*(\d+)/i, type: 'numbered' },
    { pattern: /(\d+)(?:st|nd|rd|th)\s*round/i, type: 'numbered' },
    { pattern: /round\s*(one|two|three|four|five)/i, type: 'word' },
    { pattern: /(first|second|third|fourth|fifth)\s*round/i, type: 'word' }
  ];
  
  // Check for round number
  for (const { pattern, type } of roundPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (type === 'numbered') {
        const roundNum = parseInt(match[1]);
        return { roundNumber: roundNum, interviewRound: getRoundName(roundNum) };
      } else if (type === 'word') {
        const roundNum = wordToNumber(match[1]);
        return { roundNumber: roundNum, interviewRound: getRoundName(roundNum) };
      }
    }
  }
  
  // Check for stage names (no explicit round number)
  const stagePatterns = [
    { keywords: ['technical', 'coding', 'algorithm'], round: 'technical', number: 2 },
    { keywords: ['hiring manager', 'hm'], round: 'hiring_manager', number: 3 },
    { keywords: ['recruiter', 'hr', 'screening'], round: 'recruiter', number: 1 },
    { keywords: ['final', 'onsite', 'virtual onsite'], round: 'final', number: 4 },
    { keywords: ['initial', 'first'], round: 'first', number: 1 }
  ];
  
  for (const stage of stagePatterns) {
    if (stage.keywords.some(keyword => text.includes(keyword))) {
      return { 
        roundNumber: stage.number, 
        interviewRound: stage.round 
      };
    }
  }
  
  // Default to unknown
  return { roundNumber: null, interviewRound: 'unknown' };
}

function getRoundName(roundNum) {
  const roundMap = {
    1: 'first',
    2: 'technical',
    3: 'hiring_manager',
    4: 'final'
  };
  return roundMap[roundNum] || `round_${roundNum}`;
}

function wordToNumber(word) {
  const wordMap = {
    'one': 1, 'first': 1,
    'two': 2, 'second': 2,
    'three': 3, 'third': 3,
    'four': 4, 'fourth': 4,
    'five': 5, 'fifth': 5
  };
  return wordMap[word.toLowerCase()] || null;
}

module.exports = { parseInterviewRound };