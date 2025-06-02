class PlayerDB {
    constructor(connection) {
        this.connection = connection;
    }
    
    init() {
        return this.connection.query(`CREATE TABLE IF NOT EXISTS players (
            pid VARCHAR(8) NOT NULL,
            plg VARCHAR(5) NOT NULL,
            sts INT NOT NULL,
            sfc VARCHAR(2048) NOT NULL,
            nfc VARCHAR(8192) NOT NULL,
            PRIMARY KEY (pid, plg)
        )`);
    }

    savePlayer(player) {
        if (!player.extracted) return reject("Player not extracted");
        // console.log("Saving player", player.pid, player.plg)
        return this.connection.query(
            `REPLACE INTO players (pid, plg, sts, sfc, nfc) VALUES (?, ?, ?, ?, ?)`,
            [ player.pid, player.plg, player.sts, player.sfc, player.nfc ]
        )
    }

    loadPlayer(player) {
        return new Promise(async (resolve, reject) => {
            // console.log("Loading player", player.pid, player.plg);
            try {
                var [ results, fields ] = await this.connection.query(
                    'SELECT * FROM players WHERE `pid` = ? AND `plg` = ?',
                    [ player.pid, player.plg ]
                );
                player.sts = results[0].sts;
                player.sfc = results[0].sfc;
                player.nfc = results[0].nfc;
                player.extracted = true;
                resolve(player)
            } catch(err) {
                reject(err)
            }
        })
    }
}

module.exports = PlayerDB;
