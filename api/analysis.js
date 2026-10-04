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
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido"
    });
  }
  try {
    // =======================================================
    // CONFIGURACIÓN
    // =======================================================
    const fixtureId = req.query.fixture;
    const API_KEY = process.env.API_FOOTBALL_KEY;
    if (!fixtureId) {
      return res.status(400).json({
        ok: false,
        error: "Falta el parámetro fixture"
      });
    }
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "No existe API_FOOTBALL_KEY en las variables de entorno"
      });
    }
    // =======================================================
    // FUNCIÓN API-FOOTBALL
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
          Accept: "application/json"
        }
      });
      const data = await response.json();
      return {
        http: response.status,
        data
      };
    }
    // =======================================================
    // UTILIDADES
    // =======================================================
    function number(value) {
      if (typeof value === "string") {
        value = value.replace("%", "").trim();
      }
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    function average(values) {
      const valid = values
        .map(number)
        .filter((value) => value !== null);
      if (!valid.length) {
        return null;
      }
      return (
        valid.reduce((sum, value) => sum + value, 0) /
        valid.length
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
      return Number(Number(value).toFixed(decimals));
    }
    function percentage(value) {
      if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
      ) {
        return null;
      }
      return round(Number(value), 1);
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
        ok: false,
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
    // 2. ESTADÍSTICAS DEL PARTIDO ACTUAL
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
    // 3. ÚLTIMOS PARTIDOS
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
    // 4. ESTADÍSTICAS DE CADA PARTIDO HISTÓRICO
    // =======================================================
    async function getFixtureStatistics(fixtureId) {
      try {
        const result = await apiFootball(
          "fixtures/statistics",
          {
            fixture: fixtureId
          }
        );
        return result.data?.response || [];
      } catch (error) {
        console.error(
          "Error estadísticas fixture:",
          fixtureId,
          error
        );
        return [];
      }
    }
    /*
      Obtenemos estadísticas de los partidos recientes.
      Se hace por equipo y se guarda solamente lo necesario.
    */
    async function getHistoricalStats(fixtures, teamId) {
      const result = [];
      for (const item of fixtures) {
        const stats =
          await getFixtureStatistics(
            item.fixture?.id
          );
        const teamStats = stats.find(
          (entry) =>
            Number(entry.team?.id) ===
            Number(teamId)
        );
        const values = {};
        if (teamStats) {
          (teamStats.statistics || []).forEach(
            (stat) => {
              values[stat.type] =
                stat.value;
            }
          );
        }
        result.push({
          fixture: item,
          stats: values
        });
      }
      return result;
    }
    const homeHistoricalStats =
      await getHistoricalStats(
        homeRecent,
        homeId
      );
    const awayHistoricalStats =
      await getHistoricalStats(
        awayRecent,
        awayId
      );
    // =======================================================
    // 5. PROCESAR FORMA
    // =======================================================
    function processRecentFixtures(
      fixtures,
      historicalStats,
      teamId
    ) {
      const goalsFor = [];
      const goalsAgainst = [];
      const corners = [];
      const yellowCards = [];
      const firstHalfGoals = [];
      const secondHalfGoals = [];
      let btts = 0;
      let totalMatches = 0;
      fixtures.forEach((item, index) => {
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
            ? Number(homeGoals)
            : Number(awayGoals);
        const conceded =
          isHome
            ? Number(awayGoals)
            : Number(homeGoals);
        goalsFor.push(scored);
        goalsAgainst.push(conceded);
        // Ambos marcan
        if (
          Number(homeGoals) > 0 &&
          Number(awayGoals) > 0
        ) {
          btts++;
        }
        totalMatches++;
        // Primera parte
        const halftimeHome =
          item.score?.halftime?.home;
        const halftimeAway =
          item.score?.halftime?.away;
        const halftimeScored =
          isHome
            ? halftimeHome
            : halftimeAway;
        const firstHalf =
          number(halftimeScored);
        if (firstHalf !== null) {
          firstHalfGoals.push(
            firstHalf
          );
          secondHalfGoals.push(
            Math.max(
              0,
              scored - firstHalf
            )
          );
        }
        // Estadísticas del partido
        const historical =
          historicalStats[index];
        const stats =
          historical?.stats || {};
        const matchCorners =
          number(
            stats["Corner Kicks"]
          );
        const matchYellow =
          number(
            stats["Yellow Cards"]
          );
        if (matchCorners !== null) {
          corners.push(
            matchCorners
          );
        }
        if (matchYellow !== null) {
          yellowCards.push(
            matchYellow
          );
        }
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
              firstHalfGoals
            )
          ),
        golesSegundaParte:
          round(
            average(
              secondHalfGoals
            )
          ),
        cornersPorPartido:
          round(
            average(corners)
          ),
        tarjetasPorPartido:
          round(
            average(yellowCards)
          ),
        ambosMarcan:
          totalMatches
            ? percentage(
                (btts /
                  totalMatches) *
                  100
              )
            : null
      };
    }
    const homeForm =
      processRecentFixtures(
        homeRecent,
        homeHistoricalStats,
        homeId
      );
    const awayForm =
      processRecentFixtures(
        awayRecent,
        awayHistoricalStats,
        awayId
      );
    // =======================================================
    // 6. MODELO DE GOLES
    // =======================================================
    /*
      Estimamos los goles esperados combinando:
      Local:
      - goles que marca el local
      - goles que concede el visitante
      Visitante:
      - goles que marca el visitante
      - goles que concede el local
    */
    let expectedHomeGoals = null;
    let expectedAwayGoals = null;
    if (
      homeForm.golesFavor !== null &&
      awayForm.golesContra !== null
    ) {
      expectedHomeGoals =
        (
          homeForm.golesFavor +
          awayForm.golesContra
        ) / 2;
    }
    if (
      awayForm.golesFavor !== null &&
      homeForm.golesContra !== null
    ) {
      expectedAwayGoals =
        (
          awayForm.golesFavor +
          homeForm.golesContra
        ) / 2;
    }
    const expectedTotalGoals =
      expectedHomeGoals !== null &&
      expectedAwayGoals !== null
        ? expectedHomeGoals +
          expectedAwayGoals
        : null;
    // =======================================================
    // 7. POISSON
    // =======================================================
    function factorial(n) {
      if (n <= 1) return 1;
      let result = 1;
      for (let i = 2; i <= n; i++) {
        result *= i;
      }
      return result;
    }
    function poisson(lambda, goals) {
      if (
        lambda === null ||
        !Number.isFinite(lambda)
      ) {
        return 0;
      }
      return (
        Math.exp(-lambda) *
        Math.pow(lambda, goals) /
        factorial(goals)
      );
    }
    function probabilityOver(lambda, line) {
      if (
        lambda === null ||
        !Number.isFinite(lambda)
      ) {
        return null;
      }
      const maxGoals =
        Math.floor(line);
      let underOrEqual = 0;
      for (
        let goals = 0;
        goals <= maxGoals;
        goals++
      ) {
        underOrEqual +=
          poisson(
            lambda,
            goals
          );
      }
      return (
        1 - underOrEqual
      ) * 100;
    }
    function probabilityBTTS(
      homeLambda,
      awayLambda
    ) {
      if (
        homeLambda === null ||
        awayLambda === null
      ) {
        return null;
      }
      const homeNoGoal =
        poisson(
          homeLambda,
          0
        );
      const awayNoGoal =
        poisson(
          awayLambda,
          0
        );
      return (
        1 -
        homeNoGoal -
        awayNoGoal +
        homeNoGoal *
          awayNoGoal
      ) * 100;
    }
    const over15 =
      probabilityOver(
        expectedTotalGoals,
        1.5
      );
    const over25 =
      probabilityOver(
        expectedTotalGoals,
        2.5
      );
    const bttsProbability =
      probabilityBTTS(
        expectedHomeGoals,
        expectedAwayGoals
      );
    // =======================================================
    // 8. MERCADOS DESTACADOS
    // =======================================================
    const mercados = [];
    if (over15 !== null) {
      mercados.push({
        mercado:
          "Más de 1.5 goles",
        probabilidad:
          round(over15, 1),
        confianza:
          getConfidence(over15),
        descripcion:
          "Estimación basada en el modelo de goles de ambos equipos."
      });
    }
    if (over25 !== null) {
      mercados.push({
        mercado:
          "Más de 2.5 goles",
        probabilidad:
          round(over25, 1),
        confianza:
          getConfidence(over25),
        descripcion:
          "Estimación estadística mediante distribución de Poisson."
      });
    }
    if (
      bttsProbability !== null
    ) {
      mercados.push({
        mercado:
          "Ambos equipos marcan",
        probabilidad:
          round(
            bttsProbability,
            1
          ),
        confianza:
          getConfidence(
            bttsProbability
          ),
        descripcion:
          "Probabilidad estimada de que ambos equipos marquen al menos un gol."
      });
    }
    // Ordenar de mayor a menor
    mercados.sort(
      (a, b) =>
        b.probabilidad -
        a.probabilidad
    );
    // =======================================================
    // CONFIANZA
    // =======================================================
    function getConfidence(probability) {
      if (probability >= 75) {
        return "Alta";
      }
      if (probability >= 60) {
        return "Media";
      }
      return "Baja";
    }
    // =======================================================
    // 9. ESTADÍSTICAS DEL PARTIDO
    // =======================================================
    const matchStats = {
      local: {
        posesion:
          homeMatchStats[
            "Ball Possession"
          ] || null,
        tiros:
          homeMatchStats[
            "Total Shots"
          ] || null,
        tirosPuerta:
          homeMatchStats[
            "Shots on Goal"
          ] || null,
        corners:
          homeMatchStats[
            "Corner Kicks"
          ] || null,
        faltas:
          homeMatchStats[
            "Fouls"
          ] || null,
        tarjetasAmarillas:
          homeMatchStats[
            "Yellow Cards"
          ] || null,
        tarjetasRojas:
          homeMatchStats[
            "Red Cards"
          ] || null,
        pases:
          homeMatchStats[
            "Total passes"
          ] || null,
        precisionPases:
          homeMatchStats[
            "Passes %"
          ] || null
      },
      visitante: {
        posesion:
          awayMatchStats[
            "Ball Possession"
          ] || null,
        tiros:
          awayMatchStats[
            "Total Shots"
          ] || null,
        tirosPuerta:
          awayMatchStats[
            "Shots on Goal"
          ] || null,
        corners:
          awayMatchStats[
            "Corner Kicks"
          ] || null,
        faltas:
          awayMatchStats[
            "Fouls"
          ] || null,
        tarjetasAmarillas:
          awayMatchStats[
            "Yellow Cards"
          ] || null,
        tarjetasRojas:
          awayMatchStats[
            "Red Cards"
          ] || null,
        pases:
          awayMatchStats[
            "Total passes"
          ] || null,
        precisionPases:
          awayMatchStats[
            "Passes %"
          ] || null
      }
    };
    // =======================================================
    // 10. JUGADORES
    // =======================================================
    async function getPlayers(teamId) {
      const result =
        await apiFootball(
          "players",
          {
            team: teamId,
            season: league.season
          }
        );
      return (
        result.data?.response ||
        []
      );
    }
    let homePlayers = [];
    let awayPlayers = [];
    try {
      homePlayers =
        await getPlayers(
          homeId
        );
    } catch (error) {
      console.error(
        "Error jugadores local:",
        error
      );
    }
    try {
      awayPlayers =
        await getPlayers(
          awayId
        );
    } catch (error) {
      console.error(
        "Error jugadores visitante:",
        error
      );
    }
    function processPlayers(
      players
    ) {
      return players
        .map((item) => {
          const player =
            item.player || {};
          const statistics =
            item.statistics?.[0] ||
            {};
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
              games.position ||
              null,
            partidos:
              games.appearences ||
              0,
            titular:
              games.lineups ||
              0,
            minutos:
              games.minutes ||
              0,
            goles:
              goals.total ||
              0,
            asistencias:
              goals.assists ||
              0,
            tiros:
              shots.total ||
              0,
            tirosPuerta:
              shots.on ||
              0,
            pases:
              passes.total ||
              0,
            precisionPases:
              passes.accuracy ||
              null
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
    // 11. RESPUESTA
    // =======================================================
    return res.status(200).json({
      ok: true,
      partido: {
        id: fixture.id,
        fecha: fixture.date,
        estado:
          fixture.status?.short ||
          null,
        estadoLargo:
          fixture.status?.long ||
          null,
        local: {
          id: homeId,
          nombre:
            teams.home.name,
          logo:
            teams.home.logo ||
            ""
        },
        visitante: {
          id: awayId,
          nombre:
            teams.away.name,
          logo:
            teams.away.logo ||
            ""
        },
        liga: {
          id: league.id,
          nombre:
            league.name,
          pais:
            league.country,
          temporada:
            league.season
        }
      },
      promedios: {
        local: homeForm,
        visitante: awayForm
      },
      modelo: {
        golesEsperados: {
          local:
            round(
              expectedHomeGoals
            ),
          visitante:
            round(
              expectedAwayGoals
            ),
          total:
            round(
              expectedTotalGoals
            )
        },
        probabilidades: {
          mas15Goles:
            round(
              over15,
              1
            ),
          mas25Goles:
            round(
              over25,
              1
            ),
          ambosMarcan:
            round(
              bttsProbability,
              1
            )
        }
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
          "Las probabilidades son estimaciones estadísticas del modelo y no garantizan resultados."
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
