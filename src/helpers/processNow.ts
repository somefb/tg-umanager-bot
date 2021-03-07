/** returs current proccess time; usefull for measuring execution time */
export default function processNow(): number {
  const hr = process.hrtime();
  return hr[0] * 1000 + hr[1] / 1e6;
}
