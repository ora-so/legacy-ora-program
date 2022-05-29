// later can be used to locally cache config / pool data if we need
const fetchOrcaConfig = async () => {
  // also /pool and /pools
  const uri = `https://api.orca.so/configs`;

  const result = await fetch(uri)
    .then((response) => response.json())
    .then((result) => result);

  return result;
};

(async () => {
  const result = JSON.parse(JSON.stringify(await fetchOrcaConfig()));

  const pools = result["pools"];
  console.log(pools["ZBC_USDC"]);
  for (const poolKey of Object.keys(pools)) {
    const pool = pools[poolKey];

    console.log("> pool: ", poolKey, pool);
  }
})();
