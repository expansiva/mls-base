module.exports = {
  apps: [{
    name: 'app',
    // script is relative to cwd; cwd is the "current" symlink, so a reload after
    // swapping the symlink runs the newly activated release.
    script: './dist/local/_102034_/l1/server/layer_1_external/transport/http/startServer.js',
    cwd: '/data/mls-base/current',   // active release (symlink)
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    kill_timeout: 180000,   // 3 min
    env: {
      NODE_ENV: 'production',
      TZ: 'UTC' // set the timezone, UTC
    },
    log_date_format: 'YYYY-MM-DDTHH:mm:ss', // mini ISO 8601 format UTC
    // fixed, known location (outside the releases) so logs persist across deploys
    // and the monitor can read them from a stable path.
    out_file: '/data/mls-base/logs/app-out.log',
    error_file: '/data/mls-base/logs/app-error.log',
    merge_logs: true
  }]
};
