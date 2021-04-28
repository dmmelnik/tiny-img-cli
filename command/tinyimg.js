const path = require('path');
const fs = require('fs');
const https = require('https');
const chalk = require('chalk');
const conf = {
    exts: ['.jpg', '.png'],
    max: 5000000,
    files: {},
    isDeep: false,
    compressCount: 1
};
class TinyImg {

    constructor(imgEntryPath, compressCount, isDeep) {
        this.conf = {
            ...conf,
            imgEntryPath,
            compressCount,
            isDeep
        };
        this.compressEdCount = 0;
    }

    /**
     * @description Отфильтруйте ожидающие файлы, чтобы получить список ожидающих файлов
     * @param {*} folder Ожидающая папка
     * @param {string} imgEntryPath Список ожидающих файлов
     * @return {*} void
     */
    compress(imgEntryPath = this.conf.imgEntryPath) {
        try {
            const filePath = path.join(imgEntryPath);
            if (!fs.existsSync(filePath)) {
                return global.tinyimg.log.error(chalk.red('Каталог или файл не существует！'));
            }

            const stats = fs.statSync(filePath);
            if (!stats.isDirectory()) {
                this.handleImgFile(stats.isFile(), stats.size, filePath);
            }
            else {
                // Прочитать папку
                fs.readdirSync(filePath).forEach(file => {
                    const fullFilePath = path.join(filePath, file);
                    const fileStat = fs.statSync(fullFilePath); // Прочитать информацию о файле
                    this.handleImgFile(fileStat.isFile(), fileStat.size, fullFilePath);
                    // Следует ли обрабатывать папки глубоко рекурсивно
                    if (this.conf.isDeep && fileStat.isDirectory()) {
                        this.compress(fullFilePath);
                    }
                });
            }
        }
        catch (e) {
            global.tinyimg.log.error(chalk.red(e.message));
        }
    }

    handleImgFile(isFile, fileSize, file) {
        if (this.isTinyImgFile(isFile, fileSize, file)) {
            this.fileUpload(file);
        }
    }

    // Фильтр безопасности файла / ограничение размера / суффикс
    isTinyImgFile(isFile, fileSize, file) {
        return isFile
            && conf.exts.includes(path.extname(file))
            && fileSize <= conf.max;
    }

    /**
     * Тело запроса
     * @param {*}
     * @returns {object} Тело запроса
     */
    buildRequestParams() {
        return {
            method: 'POST',
            hostname: 'tinypng.com',
            path: '/web/shrink',
            headers: {
                rejectUnauthorized: false,
                'X-Forwarded-For': this.getRandomIP(),
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 '
                    + '(KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
            }
        };
    }

    /**
     * @description Создать случайный заголовок xff
     * @return {string} xff header
     */
    getRandomIP() {
        return Array.from(Array(3))
            .map(() => parseInt(Math.random() * 255, 10))
            .concat([new Date().getTime() % 255])
            .join('.');
    }

    fileUpload(imgPath) {
        conf.files[imgPath] ? (conf.files[imgPath]++) : (conf.files[imgPath] = 1);
        const req = https.request(this.buildRequestParams(), res => {
            res.on('data', buffer => {
                const postInfo = JSON.parse(buffer.toString());
                if (postInfo.error) {
                    global.tinyimg.log.error(chalk.red(`Сжатие не удалось！\n Текущий файл：${imgPath} \n ${postInfo.message}`));
                }
                else {
                    this.fileUpdate(imgPath, postInfo);
                }
            });
        });
        req.write(fs.readFileSync(imgPath), 'binary');
        req.on('error', e => global.tinyimg.log.error(chalk.red(`Ошибка запроса! \n Текущий файл：${imgPath} \n, e)`)));
        req.end();
    }

    fileUpdate(entryImgPath, info) {
        const options = new URL(info.output.url);
        const req = https.request(options, res => {
            let body = '';
            res.setEncoding('binary');
            res.on('data', data => (body += data));
            res.on('end', () => {
                fs.writeFile(entryImgPath, body, 'binary', err => {
                    if (err) {
                        return global.tinyimg.log.error(chalk.green.red(log));
                    }
                    let log = '';
                    if (conf.files[entryImgPath] <= this.conf.compressCount) {
                        global.tinyimg.log.info(chalk.green
                            .bold(`${entryImgPath}：Сжатый${conf.files[entryImgPath]}次`));
                        this.fileUpload(entryImgPath);
                    }
                    else {
                        log = 'Сжат успешно:\n';
                        log += `       -Коэффициент оптимизации: ${((1 - info.output.ratio) * 100).toFixed(2)}%\n`;
                        log += `       -Оригинальный размер: ${(info.input.size / 1024).toFixed(2)}KB\n`;
                        log += `       -Сжатый размер: ${(info.output.size / 1024).toFixed(2)}KB\n`;
                        log += `       -файл：${entryImgPath}`;
                        global.tinyimg.log.info(chalk.green.bold(log));
                    }
                });
            });
        });
        req.on('error', e => global.tinyimg.log.error(chalk.green.bold(e)));
        req.end();
    }
}

module.exports = function (argv, env, program) {
    const args = program.opts();
    const imgEntryPath = args.path || argv._[0];
    const compressCount = args.count || argv._[1];
    const isDeep = args.deep;
    const tinyImg = new TinyImg(imgEntryPath, compressCount, isDeep);
    tinyImg.compress();
};