export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?league=140&season=2026",
      {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY
        }
      }
    );

    const data = await response.json();

    res.status(200).json({
      http: response.status,
      resultados: data.results,
      paging: data.paging,
      errores: data.errors,
      parametros: data.parameters
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
