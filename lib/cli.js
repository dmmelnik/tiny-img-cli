const path = require('path');
const _ = require('./util.js');
const name = require('../package.json').name;

module.exports = {
    /**
     * Базовая проверка команды
     */
    validate: (argv, env, program) => {
        const location = env.modulePath ? path.dirname(env.modulePath) : path.join(__dirname, '../');
        tinyimg.log.info('Currently running %s (%s)', name, location);
        
        let allowedCmd = [];

        if (!~allowedCmd.indexOf(argv._[0])) {
            tinyimg.log.error('Invalid command `%s`, please run `%s --help`', argv._[0], 'tinyimg');
            return false;
        }

        const allowedOptions = ['_', 'help', 'h', 'version', 'v', 'r'];
        
        Object.keys(argv).forEach(function (k) {
            if (!~allowedOptions.indexOf(k)) {
                tinyimg.log.error('The option `%s` is unregconized, please run `%s --help`', k, 'tinyimg');
                return false;
            }
        });

        return true;
    }
};