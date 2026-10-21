// Logs au format JSON, une ligne par évènement, sur la sortie standard (stdout).
// Pourquoi ? Docker récupère stdout (`docker logs`), et du JSON se filtre
// facilement avec des outils (grep, jq, Loki...).

const MS_DECIMALS = 10; // on garde 1 décimale pour la durée

// Écrit un objet sous forme d'une ligne JSON.
export function writeLog(entry) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  process.stdout.write(`${line}\n`);
}

// Middleware Express : logge chaque requête quand la réponse est terminée.
// `log` est injectable pour pouvoir le remplacer dans les tests.
export function createRequestLogger(log = writeLog) {
  return function requestLogger(req, res, next) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      log({
        level: 'info',
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(elapsedMs * MS_DECIMALS) / MS_DECIMALS,
      });
    });

    next();
  };
}
