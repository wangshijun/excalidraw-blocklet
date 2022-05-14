const proxy = require("http-proxy-middleware");

module.exports = (app) => {
  app.use(
    proxy("/socket.io", {
      target: "http://127.0.0.1:3030",
      changeOrigin: true,
      ws: true,
      logLevel: "debug",
    }),
  );
};
