export default async function handler(req, res) {
  // =========================================================
  // CORS
  // =========================================================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // =========================================================
  // VALIDAR MÉTODO
  // =========================================================
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }
  try {
    // =======================================================
    // PARÁMETROS
    // =======================================================
    const fixtureId = req.query.fixture;
    if (!fixtureId) {
      return res.status(400).json({
        error: "Falta el parámetro fixture"
      });
    }
    const API_KEY = process.env.API_FOOTBALL_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        error: "No existe API_FOOTBALL_KEY en las variables de entorno"
      });
    }
    // =======================================================
    // FUNCIÓN GENERAL PARA API-FOOTBALL
    // =======================================================
    async function apiFootball(endpoint, params = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          query.append(key, value);
        }
      });
      const url =
        "https://v3.football.api-sports.io/" +
        endpoint +
        "?" +
        query.toString();
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-apisports-key": API_KEY,
          "Accept": "application/json"
        }
      });
      const data = await response.json();
      return {
        http: response.status,
        data
      };
    }
    // =======================================================
    // 1. INFORMACIÓN DEL PARTIDO
    // =======================================================
    const fixtureResult = await apiFootball(
      "fixtures",
      {
        id: fixtureId
      }
    );
    const fixtureData =
      fixtureResult.data?.response?.[0];
    if (!fixtureData) {
      return res.status(404).json({
        error: "No se encontró el partido",
        api: fixtureResult.data?.errors || {}
      });
    }
    const fixture = fixtureData.fixture;
    const teams = fixtureData.teams;
    const league = fixtureData.league;
    const homeId = teams.home.id;
    const awayId = teams.away.id;
    // =======================================================
    // 2. ESTADÍSTICAS DEL PARTIDO
    // =======================================================
    const statisticsResult = await apiFootball(
      "fixtures/statistics",
      {
        fixture: fixtureId
      }
    );
    const statistics =
      statisticsResult.data?.response || [];
    function getTeamStatistics(teamId) {
      const item = statistics.find(
        (entry) =>
          Number(entry.team?.id) === Number(teamId)
      );
      if (!item) {
        return {};
      }
      const result = {};
      (item.statistics || []).forEach((stat) => {
        result[stat.type] = stat.value;
      });
      return result;
    }
    const homeMatchStats =
      getTeamStatistics(homeId);
    const awayMatchStats =
      getTeamStatistics(awayId);
    // =======================================================
    // 3. ÚLTIMOS PARTIDOS DE CADA EQUIPO
    // =======================================================
    async function getRecentFixtures(teamId) {
      const result = await apiFootball(
        "fixtures",
        {
          team: teamId,
          last: 10
        }
      );
      return result.data?.response || [];
    }
    const homeRecent =
      await getRecentFixtures(homeId);
    const awayRecent =
      await getRecentFixtures(awayId);
    // =======================================================
    // 4. PROCESAR ESTADÍSTICAS HISTÓRICAS
    // =======================================================
    function average(values) {
      const valid = values
        .map(Number)
        .filter(
          (value) =>
            Number.isFinite(value)
        );
      if (!valid.length) {
        return null;
      }
      return (
        valid.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / valid.length
      );
    }
    function round(value, decimals = 2) {
      if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
      ) {
        return null;
      }
      return Number(
        Number(value).toFixed(decimals)
      );
    }
    function processRecentFixtures(
      fixtures,
      teamId
    ) {
      let goalsFor = [];
      let goalsAgainst = [];
      let corners = [];
      let yellowCards = [];
      let btts = 0;
      let totalMatches = 0;
      let firstHalfGoalsFor = [];
      let secondHalfGoalsFor = [];
      fixtures.forEach((item) => {
        const homeTeam =
          item.teams?.home?.id;
        const awayTeam =
          item.teams?.away?.id;
        const homeGoals =
          item.goals?.home;
        const awayGoals =
          item.goals?.away;
        if (
          homeGoals === null ||
          awayGoals === null ||
          homeGoals === undefined ||
          awayGoals === undefined
        ) {
          return;
        }
        const isHome =
          Number(homeTeam) ===
          Number(teamId);
        const scored =
          isHome
            ? homeGoals
            : awayGoals;
        const conceded =
          isHome
            ? awayGoals
            : homeGoals;
        goalsFor.push(
          Number(scored)
        );
        goalsAgainst.push(
          Number(conceded)
        );
        if (
          Number(homeGoals) > 0 &&
          Number(awayGoals) > 0
        ) {
          btts++;
        }
        totalMatches++;
        // API-Football puede devolver los goles
        // por parte en fixtures completos.
        const halftimeHome =
          item.score?.halftime?.home;
        const halftimeAway =
          item.score?.halftime?.away;
        const halftimeScored =
          isHome
            ? halftimeHome
            : halftimeAway;
        const halftimeTotal =
          Number.isFinite(
            Number(halftimeScored)
          )
            ? Number(halftimeScored)
            : 0;
        const secondHalf =
          Number(scored) -
          halftimeTotal;
        firstHalfGoalsFor.push(
          halftimeTotal
        );
        secondHalfGoalsFor.push(
          secondHalf
        );
      });
      return {
        partidos: totalMatches,
        golesFavor:
          round(
            average(goalsFor)
          ),
        golesContra:
          round(
            average(goalsAgainst)
          ),
        golesPrimeraParte:
          round(
            average(
              firstHalfGoalsFor
            )
          ),
        golesSegundaParte:
          round(
            average(
              secondHalfGoalsFor
            )
          ),
        ambosMarcan:
          totalMatches
            ? round(
                (btts /
                  totalMatches) *
                  100
              )
            : null,
        cornersPorPartido:
          round(
            average(corners)
          ),
        tarjetasPorPartido:
          round(
            average(yellowCards)
          )
      };
    }
    const homeForm =
      processRecentFixtures(
        homeRecent,
        homeId
      );
    const awayForm =
      processRecentFixtures(
        awayRecent,
        awayId
      );
    // =======================================================
    // 5. ESTADÍSTICAS DEL PARTIDO ACTUAL
    // =======================================================
    function parsePercentage(value) {
      if (
        typeof value === "string" &&
        value.includes("%")
      ) {
        return Number(
          value.replace("%", "")
        );
      }
      return Number(value);
    }
    const matchStats = {
      local: {
        posesion:
          homeMatchStats["Ball Possession"] || null,
        tiros:
          homeMatchStats["Total Shots"] || null,
        tirosPuerta:
          homeMatchStats["Shots on Goal"] || null,
        corners:
          homeMatchStats["Corner Kicks"] || null,
        faltas:
          homeMatchStats["Fouls"] || null,
        tarjetasAmarillas:
          homeMatchStats["Yellow Cards"] || null,
        tarjetasRojas:
          homeMatchStats["Red Cards"] || null,
        pases:
          homeMatchStats["Total passes"] || null,
        precisionPases:
          homeMatchStats["Passes %"] || null
      },
      visitante: {
        posesion:
          awayMatchStats["Ball Possession"] || null,
        tiros:
          awayMatchStats["Total Shots"] || null,
        tirosPuerta:
          awayMatchStats["Shots on Goal"] || null,
        corners:
          awayMatchStats["Corner Kicks"] || null,
        faltas:
          awayMatchStats["Fouls"] || null,
        tarjetasAmarillas:
          awayMatchStats["Yellow Cards"] || null,
        tarjetasRojas:
          awayMatchStats["Red Cards"] || null,
        pases:
          awayMatchStats["Total passes"] || null,
        precisionPases:
          awayMatchStats["Passes %"] || null
      }
    };
    // =======================================================
    // 6. JUGADORES
    // =======================================================
    async function getPlayers(teamId) {
      const result = await apiFootball(
        "players",
        {
          team: teamId,
          season:
            league.season
        }
      );
      return result.data?.response || [];
    }
    let homePlayers = [];
    let awayPlayers = [];
    try {
      homePlayers =
        await getPlayers(homeId);
    } catch (error) {
      console.error(
        "Error jugadores local:",
        error
      );
    }
    try {
      awayPlayers =
        await getPlayers(awayId);
    } catch (error) {
      console.error(
        "Error jugadores visitante:",
        error
      );
    }
    function processPlayers(players) {
      return players
        .map((item) => {
          const player =
            item.player || {};
          const statistics =
            item.statistics?.[0] || {};
          const games =
            statistics.games || {};
          const goals =
            statistics.goals || {};
          const shots =
            statistics.shots || {};
          const passes =
            statistics.passes || {};
          return {
            id: player.id,
            nombre: player.name,
            foto: player.photo,
            posicion:
              games.position || null,
            partidos:
              games.appearences || 0,
            titular:
              games.lineups || 0,
            minutos:
              games.minutes || 0,
            goles:
              goals.total || 0,
            asistencias:
              goals.assists || 0,
            tiros:
              shots.total || 0,
            tirosPuerta:
              shots.on || 0,
            pases:
              passes.total || 0,
            precisionPases:
              passes.accuracy || null
          };
        })
        .filter(
          (player) =>
            player.nombre
        )
        .sort(
          (a, b) =>
            Number(b.goles || 0) -
            Number(a.goles || 0)
        )
        .slice(0, 10);
    }
    const homePlayerStats =
      processPlayers(
        homePlayers
      );
    const awayPlayerStats =
      processPlayers(
        awayPlayers
      );
    // =======================================================
    // 7. MERCADOS DESTACADOS
    // =======================================================
    const homeGoals =
      homeForm.golesFavor;
    const awayGoals =
      awayForm.golesFavor;
    const expectedGoals =
      homeGoals !== null &&
      awayGoals !== null
        ? homeGoals + awayGoals
        : null;
    const bttsHome =
      homeForm.ambosMarcan;
    const bttsAway =
      awayForm.ambosMarcan;
    const bttsAverage =
      bttsHome !== null &&
      bttsAway !== null
        ? (
            bttsHome +
            bttsAway
          ) / 2
        : null;
    const mercados = [];
    if (
      expectedGoals !== null
    ) {
      mercados.push({
        mercado: "Más de 1.5 goles",
        valorModelo:
          round(
            expectedGoals,
            2
          ),
        tipo: "goles",
        descripcion:
          "Basado en el promedio reciente de goles de ambos equipos."
      });
    }
    if (
      expectedGoals !== null
    ) {
      mercados.push({
        mercado: "Más de 2.5 goles",
        valorModelo:
          round(
            expectedGoals,
            2
          ),
        tipo: "goles",
        descripcion:
          "Referencia estadística basada en la producción goleadora reciente."
      });
    }
    if (
      bttsAverage !== null
    ) {
      mercados.push({
        mercado: "Ambos equipos marcan",
        valorModelo:
          round(
            bttsAverage,
            1
          ),
        tipo: "btts",
        descripcion:
          "Porcentaje medio de partidos recientes en los que ambos equipos marcaron."
      });
    }
    // =======================================================
    // 8. RESPUESTA FINAL
    // =======================================================
    return res.status(200).json({
      ok: true,
      partido: {
        id: fixture.id,
        fecha: fixture.date,
        estado:
          fixture.status?.short || null,
        estadoLargo:
          fixture.status?.long || null,
        local: {
          id: homeId,
          nombre:
            teams.home.name,
          logo:
            teams.home.logo || ""
        },
        visitante: {
          id: awayId,
          nombre:
            teams.away.name,
          logo:
            teams.away.logo || ""
        },
        liga: {
          id: league.id,
          nombre: league.name,
          pais: league.country,
          temporada: league.season
        }
      },
      promedios: {
        local: homeForm,
        visitante: awayForm
      },
      estadisticasPartido:
        matchStats,
      jugadores: {
        local:
          homePlayerStats,
        visitante:
          awayPlayerStats
      },
      mercados,
      meta: {
        partidosAnalizadosLocal:
          homeRecent.length,
        partidosAnalizadosVisitante:
          awayRecent.length,
        nota:
          "Los valores son estadísticas y estimaciones del modelo; no garantizan resultados."
      }
    });
  } catch (error) {
    console.error(
      "BetAI analysis error:",
      error
    );
    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Error interno del servidor"
    });
  }
}
