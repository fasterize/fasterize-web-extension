var optimizedCodes = ['o', 'pl'];
var inProgressCodes = ['w'];
var errorCodes = ['e', 't', 'vf', '!id', '!conf', 'b', 'ed', 'cbo'];
var cachedCodes = ['c', 'clc', 'sc'];
var headersHints = ['pl'];

var codeMapping = {
  p: 'request/response proxified',
  o: 'optimized',
  '!o': 'not optimized',
  w: 'optimization in progress',
  Z: 'non optimizable page (will never be optimized, 404, 301, 302, POST, etc.).',
  ab: 'excluded because of A/B testing',
  stc: 'https status code of the origin different than 200',
  zc: 'empty content',
  ecc: 'excluded by customer configuration',
  tecc: 'tag excluded by the configuration',
  m: 'method (HEAD, PROPFIND, OPTIONS, PUT, DELETE, etc.)',
  ed: 'engine disabled',
  h: 'non HTML content (for example, JSON sent with a tex/html content type)',
  c: 'cached',
  sc: 'page is cached via SmartCache (Cache + Ajax)',
  dc: 'optimized, dynamic cache (internal engine behavior)',
  '!c': 'not cached',
  v: 'virtual object (concatenation result or outlining)',
  e: 'error, optimization failed, the page is not optimized',
  vf: 'reconstituted virtual object',
  t: 'timeout, the optimization has taken too much time, the page is not optimized',
  ccb:
    'Cache CallBack, object is served from the cache by proxy (this is the case where an object doesn’t have a cookie for A/B test',
  clc: 'page is cached via Cookie Less Cache',
  cbo:
    'Circuit Breaker Open, the object is not optimized because of temporary unavailability of one of the engine component',
  of: 'Overflow, show that overflow system is in place. Following flags clarify the results.',
  '!id': 'No id',
  '!conf': 'no configuration found',
  '!en': 'overflow not enabled',
  wen: 'overflow was enabled',
  en: 'overflow enabled',
  dis: 'disallow, user was send back to the waiting page',
  pp: 'partial page',
  ed: 'engine disabled',
  b: 'blocked, IP address is blocked',
  uc: 'User Canceled, request was cancelled by the user',
  pl: 'Preload headers',
  tb: 'Too big',
};

var keycdnPOP = {
  aedu: 'Dubai',
  arba: 'Buenos Aires',
  atvi: 'Vienna',
  aupe: 'Perth',
  ausy: 'Sydney',
  brsp: 'São Paulo',
  camo: 'Montreal',
  chzh: 'Zurich',
  clsa: 'Santiago',
  cnhk: 'Hong Kong',
  defr: 'Frankfurt',
  esma: 'Madrid',
  frpa: 'Paris',
  idja: 'Jakarta',
  ilta: 'Tel Aviv',
  inba: 'Bangalore',
  itmi: 'Milano',
  jptk: 'Tokyo',
  krse: 'Seoul',
  nlam: 'Amsterdam',
  noos: 'Oslo',
  nzau: 'Auckland',
  plwa: 'Warsaw',
  rumo: 'Moscow',
  sest: 'Stockholm',
  sgsg: 'Singapore',
  tris: 'Istanbul',
  twta: 'Taipei',
  uklo: 'London',
  usat: 'Atlanta',
  usch: 'Chicago',
  usda: 'Dallas',
  usde: 'Denver',
  usla: 'Los Angeles',
  usmi: 'Miami',
  usse: 'Seattle',
  ussj: 'San Jose',
  uswd: 'Washington',
  zajo: 'Johannesburg',
};

// from https://www.feitsui.com/en/blog/page/3.
var cloudfrontPOP = {
  'EZE51-C1': {
    City: 'Buenos Aires',
    Country: 'Argentina',
  },
  MEL50: {
    City: 'Melbourne',
    Country: 'Australia',
  },
  'PER50-C1': {
    City: 'Perth',
    Country: 'Australia',
  },
  'SYD1-C1': {
    City: 'Sydney',
    Country: 'Australia',
  },
  'SYD1-C2': {
    City: 'Sydney',
    Country: 'Australia',
  },
  'SYD4-C1': {
    City: 'Sydney',
    Country: 'Australia',
  },
  'SYD4-C2': {
    City: 'Sydney',
    Country: 'Australia',
  },
  'VIE50-C1': {
    City: 'Vienna',
    Country: 'Austria',
  },
  'BAH53-C1': {
    City: 'Manama',
    Country: 'Bahrain',
  },
  'BRU50-C1': {
    City: 'Brussels',
    Country: 'Belgium',
  },
  'GIG51-C1': {
    City: 'Rio de Janeiro',
    Country: 'Brazil',
  },
  'GIG51-C2': {
    City: 'Rio de Janeiro',
    Country: 'Brazil',
  },
  GRU1: {
    City: 'São Paulo',
    Country: 'Brazil',
  },
  'GRU1-C1': {
    City: 'São Paulo',
    Country: 'Brazil',
  },
  GRU50: {
    City: 'São Paulo',
    Country: 'Brazil',
  },
  'GRU50-C1': {
    City: 'São Paulo',
    Country: 'Brazil',
  },
  'YUL62-C1': {
    City: 'Montréal, QC',
    Country: 'Canada',
  },
  'YTO50-C1': {
    City: 'Toronto, ON',
    Country: 'Canada',
  },
  'SCL50-C1': {
    City: 'Santiago',
    Country: 'Chile',
  },
  BJS: {
    City: 'Beijing',
    Country: 'China',
  },
  HKG50: {
    City: 'Hong Kong',
    Country: 'China',
  },
  HKG51: {
    City: 'Hong Kong',
    Country: 'China',
  },
  HKG53: {
    City: 'Hong Kong',
    Country: 'China',
  },
  'HKG54-C1': {
    City: 'Hong Kong',
    Country: 'China',
  },
  'HKG60-C1': {
    City: 'Hong Kong',
    Country: 'China',
  },
  'HKG62-C1': {
    City: 'Hong Kong',
    Country: 'China',
  },
  SHA: {
    City: 'Shanghai',
    Country: 'China',
  },
  SZX: {
    City: 'Shenzhen',
    Country: 'China',
  },
  'TPE50-C1': {
    City: 'Taipei, TW',
    Country: 'China',
  },
  'TPE51-C1': {
    City: 'Taipei, TW',
    Country: 'China',
  },
  'TPE52-C1': {
    City: 'Taipei, TW',
    Country: 'China',
  },
  ZHY: {
    City: 'Zhongwei, Ningxia',
    Country: 'China',
  },
  'BOG50-C1': {
    City: 'Bogotá',
    Country: 'Colombia',
  },
  PRG50: {
    City: 'Prague',
    Country: 'Czech Republic',
  },
  'CPH50-C1': {
    City: 'Copenhagen',
    Country: 'Denmark',
  },
  'HEL50-C1': {
    City: 'Helsinki',
    Country: 'Finland',
  },
  MRS50: {
    City: 'Marseille',
    Country: 'France',
  },
  CDG3: {
    City: 'Paris',
    Country: 'France',
  },
  'CDG3-C1': {
    City: 'Paris',
    Country: 'France',
  },
  'CDG3-C2': {
    City: 'Paris',
    Country: 'France',
  },
  'CDG50-C1': {
    City: 'Paris',
    Country: 'France',
  },
  'CDG53-C1': {
    City: 'Paris',
    Country: 'France',
  },
  CDG54: {
    City: 'Paris',
    Country: 'France',
  },
  TXL51: {
    City: 'Berlin',
    Country: 'Germany',
  },
  'TXL52-C1': {
    City: 'Berlin',
    Country: 'Germany',
  },
  FRA2: {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'FRA2-C1': {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'FRA2-C2': {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'FRA6-C1': {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  FRA50: {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'FRA50-C1': {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  FRA53: {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'FRA53-C1': {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  FRA54: {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  FRA56: {
    City: 'Frankfurt',
    Country: 'Germany',
  },
  'MUC50-C1': {
    City: 'Munich',
    Country: 'Germany',
  },
  MUC51: {
    City: 'Munich',
    Country: 'Germany',
  },
  'MUC51-C1': {
    City: 'Munich',
    Country: 'Germany',
  },
  'BLR50-C1': {
    City: 'Bangalore',
    Country: 'India',
  },
  'BLR50-C2': {
    City: 'Bangalore',
    Country: 'India',
  },
  'BLR50-C3': {
    City: 'Bangalore',
    Country: 'India',
  },
  MAA3: {
    City: 'Chennai',
    Country: 'India',
  },
  'MAA50-C1': {
    City: 'Chennai',
    Country: 'India',
  },
  'HYD50-C1': {
    City: 'Hyderabad',
    Country: 'India',
  },
  'HYD50-C2': {
    City: 'Hyderabad',
    Country: 'India',
  },
  'HYD50-C3': {
    City: 'Hyderabad',
    Country: 'India',
  },
  'HYD50-C4': {
    City: 'Hyderabad',
    Country: 'India',
  },
  'BOM50-C1': {
    City: 'Mumbai',
    Country: 'India',
  },
  'BOM51-C1': {
    City: 'Mumbai',
    Country: 'India',
  },
  'BOM51-C2': {
    City: 'Mumbai',
    Country: 'India',
  },
  BOM52: {
    City: 'Mumbai',
    Country: 'India',
  },
  DEL51: {
    City: 'New Delhi',
    Country: 'India',
  },
  'DEL54-C1': {
    City: 'New Delhi',
    Country: 'India',
  },
  'DEL54-C3': {
    City: 'New Delhi',
    Country: 'India',
  },
  'DEL54-C4': {
    City: 'New Delhi',
    Country: 'India',
  },
  'DUB2-C1': {
    City: 'Dublin',
    Country: 'Ireland',
  },
  'TLV50-C1': {
    City: 'Tel Aviv',
    Country: 'Israel',
  },
  'MXP64-C1': {
    City: 'Milan',
    Country: 'Italy',
  },
  'MXP64-C2': {
    City: 'Milan',
    Country: 'Italy',
  },
  PMO50: {
    City: 'Palermo',
    Country: 'Italy',
  },
  'NRT12-C1': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT12-C2': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT12-C3': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT12-C4': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  NRT20: {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT20-C1': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT20-C2': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT20-C3': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT20-C4': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  NRT51: {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT51-C1': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT51-C2': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT51-C3': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  NRT52: {
    City: 'Tokyo',
    Country: 'Japan',
  },
  NRT53: {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT57-C1': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT57-C2': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT57-C3': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  'NRT57-C4': {
    City: 'Tokyo',
    Country: 'Japan',
  },
  KUL50: {
    City: 'Kuala Lumpur',
    Country: 'Malaysia',
  },
  'KUL50-C1': {
    City: 'Kuala Lumpur',
    Country: 'Malaysia',
  },
  'OSL50-C1': {
    City: 'Oslo',
    Country: 'Norway',
  },
  MNL50: {
    City: 'Manila',
    Country: 'Philippines',
  },
  'MNL50-C1': {
    City: 'Manila',
    Country: 'Philippines',
  },
  'WAW50-C1': {
    City: 'Warsaw',
    Country: 'Poland',
  },
  'LIS50-C1': {
    City: 'Lisbon',
    Country: 'Portugal',
  },
  'SIN2-C1': {
    City: 'Singapore',
    Country: 'Singapore',
  },
  'SIN5-C1': {
    City: 'Singapore',
    Country: 'Singapore',
  },
  'SIN52-C2': {
    City: 'Singapore',
    Country: 'Singapore',
  },
  CPT50: {
    City: 'Cape Town',
    Country: 'South Africa',
  },
  JNB50: {
    City: 'Johannesburg',
    Country: 'South Africa',
  },
  ICN50: {
    City: 'Seoul',
    Country: 'South Korea',
  },
  'ICN51-C1': {
    City: 'Seoul',
    Country: 'South Korea',
  },
  ICN54: {
    City: 'Seoul',
    Country: 'South Korea',
  },
  'ICN54-C1': {
    City: 'Seoul',
    Country: 'South Korea',
  },
  'ICN54-C2': {
    City: 'Seoul',
    Country: 'South Korea',
  },
  'ICN55-C1': {
    City: 'Seoul',
    Country: 'South Korea',
  },
  MAD50: {
    City: 'Madrid',
    Country: 'Spain',
  },
  'MAD50-C1': {
    City: 'Madrid',
    Country: 'Spain',
  },
  'MAD51-C1': {
    City: 'Madrid',
    Country: 'Spain',
  },
  'ARN1-C1': {
    City: 'Stockholm',
    Country: 'Sweden',
  },
  ARN53: {
    City: 'Stockholm',
    Country: 'Sweden',
  },
  ARN54: {
    City: 'Stockholm',
    Country: 'Sweden',
  },
  ZRH50: {
    City: 'Zürich',
    Country: 'Switzerland',
  },
  'ZRH50-C1': {
    City: 'Zürich',
    Country: 'Switzerland',
  },
  AMS1: {
    City: 'Amsterdam',
    Country: 'The Netherlands',
  },
  AMS50: {
    City: 'Amsterdam',
    Country: 'The Netherlands',
  },
  'AMS54-C1': {
    City: 'Amsterdam',
    Country: 'The Netherlands',
  },
  'DXB50-C1': {
    City: 'Dubai',
    Country: 'United Arab Emirates',
  },
  'FJR50-C1': {
    City: 'Fujairah',
    Country: 'United Arab Emirates',
  },
  'LHR3-C1': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR3-C2': {
    City: 'London',
    Country: 'United Kingdom',
  },
  LHR4: {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR50-C1': {
    City: 'London',
    Country: 'United Kingdom',
  },
  LHR52: {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR52-C1': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR61-C1': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR61-C2': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR62-C1': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR62-C2': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'LHR62-C3': {
    City: 'London',
    Country: 'United Kingdom',
  },
  'MAN50-C1': {
    City: 'Manchester',
    Country: 'United Kingdom',
  },
  'MAN50-C2': {
    City: 'Manchester',
    Country: 'United Kingdom',
  },
  IAD16: {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  IAD53: {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'IAD79-C1': {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'IAD79-C2': {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'IAD79-C3': {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'IAD89-C1': {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'IAD89-C2': {
    City: 'Ashburn, VA',
    Country: 'United States',
  },
  'ATL50-C1': {
    City: 'Atlanta, GA',
    Country: 'United States',
  },
  'ATL51-C1': {
    City: 'Atlanta, GA',
    Country: 'United States',
  },
  'ATL52-C1': {
    City: 'Atlanta, GA',
    Country: 'United States',
  },
  BOS50: {
    City: 'Boston, MA',
    Country: 'United States',
  },
  'BOS50-C1': {
    City: 'Boston, MA',
    Country: 'United States',
  },
  'BOS50-C2': {
    City: 'Boston, MA',
    Country: 'United States',
  },
  ORD50: {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'ORD50-C1': {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'ORD51-C1': {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'ORD51-C2': {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'ORD52-C1': {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'ORD52-C2': {
    City: 'Chicago, IL',
    Country: 'United States',
  },
  'DFW3-C1': {
    City: 'Dallas/Fort Worth, TX',
    Country: 'United States',
  },
  'DFW50-C1': {
    City: 'Dallas/Fort Worth, TX',
    Country: 'United States',
  },
  DFW53: {
    City: 'Dallas/Fort Worth, TX',
    Country: 'United States',
  },
  'DFW53-C1': {
    City: 'Dallas/Fort Worth, TX',
    Country: 'United States',
  },
  DFW54: {
    City: 'Dallas/Fort Worth, TX',
    Country: 'United States',
  },
  'DEN50-C1': {
    City: 'Denver, CO',
    Country: 'United States',
  },
  'DEN50-C2': {
    City: 'Denver, CO',
    Country: 'United States',
  },
  'HIO50-C1': {
    City: 'Hillsboro, OR',
    Country: 'United States',
  },
  'HIO51-C1': {
    City: 'Hillsboro, OR',
    Country: 'United States',
  },
  'IAH50-C1': {
    City: 'Houston, TX',
    Country: 'United States',
  },
  'IAH50-C2': {
    City: 'Houston, TX',
    Country: 'United States',
  },
  'IAH50-C3': {
    City: 'Houston, TX',
    Country: 'United States',
  },
  'IAH50-C4': {
    City: 'Houston, TX',
    Country: 'United States',
  },
  'JAX1-C1': {
    City: 'Jacksonville, FL',
    Country: 'United States',
  },
  LAX1: {
    City: 'Los Angeles, CA',
    Country: 'United States',
  },
  'LAX3-C1': {
    City: 'Los Angeles, CA',
    Country: 'United States',
  },
  'LAX3-C2': {
    City: 'Los Angeles, CA',
    Country: 'United States',
  },
  'LAX3-C3': {
    City: 'Los Angeles, CA',
    Country: 'United States',
  },
  'LAX3-C4': {
    City: 'Los Angeles, CA',
    Country: 'United States',
  },
  'MIA3-C1': {
    City: 'Miami, FL',
    Country: 'United States',
  },
  'MIA3-C2': {
    City: 'Miami, FL',
    Country: 'United States',
  },
  'MIA3-C3': {
    City: 'Miami, FL',
    Country: 'United States',
  },
  MIA50: {
    City: 'Miami, FL',
    Country: 'United States',
  },
  'MSP50-C1': {
    City: 'Minneapolis, MN',
    Country: 'United States',
  },
  JFK1: {
    City: 'New York, NY',
    Country: 'United States',
  },
  JFK5: {
    City: 'New York, NY',
    Country: 'United States',
  },
  JFK6: {
    City: 'New York, NY',
    Country: 'United States',
  },
  'JFK51-C1': {
    City: 'New York, NY',
    Country: 'United States',
  },
  EWR50: {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR50-C1': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR52-C1': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR52-C2': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR52-C3': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR52-C4': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR53-C1': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  'EWR53-C2': {
    City: 'Newark, NJ',
    Country: 'United States',
  },
  PHL50: {
    City: 'Philadelphia, PA',
    Country: 'United States',
  },
  'PHL50-C1': {
    City: 'Philadelphia, PA',
    Country: 'United States',
  },
  'PHX50-C1': {
    City: 'Phoenix, AZ',
    Country: 'United States',
  },
  'PHX50-C2': {
    City: 'Phoenix, AZ',
    Country: 'United States',
  },
  'SLC50-C1': {
    City: 'Salt Lake City, UT',
    Country: 'United States',
  },
  'SFO5-C1': {
    City: 'San Francisco, CA',
    Country: 'United States',
  },
  'SFO5-C3': {
    City: 'San Francisco, CA',
    Country: 'United States',
  },
  SFO9: {
    City: 'San Francisco, CA',
    Country: 'United States',
  },
  SFO20: {
    City: 'San Francisco, CA',
    Country: 'United States',
  },
  SEA4: {
    City: 'Seattle, WA',
    Country: 'United States',
  },
  SEA19: {
    City: 'Seattle, WA',
    Country: 'United States',
  },
  'SEA19-C1': {
    City: 'Seattle, WA',
    Country: 'United States',
  },
  'SEA19-C2': {
    City: 'Seattle, WA',
    Country: 'United States',
  },
  SEA32: {
    City: 'Seattle, WA',
    Country: 'United States',
  },
  IND6: {
    City: 'South Bend, IN',
    Country: 'United States',
  },
};

var frzPoP = [
  {
    pop: 'frpa',
    popName: 'Paris (France)',
    ip: ['212.83.128.22', '212.83.173.208', '212.83.161.118'],
  },
  {
    pop: 'usny',
    popName: 'New-York (United States)',
    ip: ['162.243.74.238'],
  },
  {
    pop: 'ussf',
    popName: 'San Francisco (United States)',
    ip: ['104.236.170.152'],
  },
  {
    pop: 'frstag',
    popName: 'Paris (Staging environment)',
    ip: ['95.85.35.99', '95.85.12.61'],
  },
];

var frzIP = frzPoP.reduce(function(acc, arr) {
  return { ip: acc.ip.concat(arr.ip) };
}).ip;
