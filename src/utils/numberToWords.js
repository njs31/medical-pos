const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(num) {
  if (num < 20) return ones[num];
  return `${tens[Math.floor(num / 10)]} ${ones[num % 10]}`.trim();
}

function threeDigits(num) {
  const hundred = Math.floor(num / 100);
  const rest = num % 100;
  const parts = [];
  if (hundred) parts.push(`${ones[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

function integerToIndianWords(num) {
  if (num === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;

  if (crore) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${integerToIndianWords(lakh)} Lakh`);
  if (thousand) parts.push(`${integerToIndianWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ').trim();
}

export function numberToIndianWords(value = 0) {
  const amount = Number(value || 0);
  if (amount < 0) return `Negative ${numberToIndianWords(Math.abs(amount))}`;
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const rupeeWords = `${integerToIndianWords(rupees)} Rupees`;
  if (!paise) return `${rupeeWords} Only`;
  return `${rupeeWords} and ${integerToIndianWords(paise)} Paise Only`;
}
