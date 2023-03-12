let net = require('net');
let http = require('http');

let client = new net.Socket();
client.connect(30002, '10.0.0.78', function () {
    console.log('Connected');
    client.write('Hello, server! Love, Client.');
});

class ElAzCalc {
    calculate(userLat, userLon, lat, lon, userAlt, alt) {
        //logging receiver range stats
        let dLat = (userLat - lat) * -1
        let latDistance = 0.62137 * (Math.abs(dLat) * 110.574)

        let dLon = (userLon - lon) * -1
        let lonDistance = 0.62137 * (Math.abs(dLon) * (111.320 * Math.cos(lat * (Math.PI / 180))))

        let distance = Math.sqrt(latDistance ** 2 + lonDistance ** 2)
        let azimuth = Math.atan(dLon / dLat) * (180 / Math.PI)
        if (azimuth < 0) azimuth += 360
        if (dLon < 0 && dLat < 0) azimuth += 180
        if (dLon > 0 && dLat < 0) azimuth += 180
        if (azimuth > 360) azimuth -= 360

        //meters
        let dAlt = (alt - userAlt) * 0.0003048
        let el = Math.atan(dAlt / distance) * (180 / Math.PI)

        return [distance, azimuth, el]
    }
}

class Aircrafts {
    constructor() {
        this.contactList = []
    }
    addContact(contact) {
        this.contactList.push(contact)
    }
}

class Contact {
    #charDecode = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ#####_###############0123456789######"
    constructor(downlinkFormat, xpdrCapability, icao) {
        this.downlinkFormat = downlinkFormat
        this.xpdrCapability = xpdrCapability
        this.icao = icao
        this.time = Date.now()
    }
    updateInfo(tc, buffer, bin) {
        this.time = Date.now()
        if (tc >= 1 && tc <= 4) {
            this.ec = parseInt(buffer.substring(0, 3), 2)
            if (this.ec == 0) this.ec = "No Info"
            else if (this.ec == 1) this.ec = "Light"
            else if (this.ec == 2) this.ec = "Small"
            else if (this.ec == 3) this.ec = "Large"
            else if (this.ec == 4) this.ec = "High Vortex Large"
            else if (this.ec == 5) this.ec = "Heavy"
            else if (this.ec == 6) this.ec = "High Performance"
            else if (this.ec == 7) this.ec = "Rotorcraft"

            let c1 = this.#charDecode[parseInt(buffer.substring(3, 9), 2)]
            let c2 = this.#charDecode[parseInt(buffer.substring(9, 15), 2)]
            let c3 = this.#charDecode[parseInt(buffer.substring(15, 21), 2)]
            let c4 = this.#charDecode[parseInt(buffer.substring(21, 27), 2)]
            let c5 = this.#charDecode[parseInt(buffer.substring(27, 33), 2)]
            let c6 = this.#charDecode[parseInt(buffer.substring(33, 39), 2)]
            let c7 = this.#charDecode[parseInt(buffer.substring(39, 45), 2)]
            let c8 = this.#charDecode[parseInt(buffer.substring(45, 51), 2)]
            this.callsign = (c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8).replace(/_/g, "")
        } else if (tc >= 9 && tc <= 18) {
            this.ss = parseInt(bin.substring(37, 39), 2)
            if (this.ss == 0) this.ss = "No Condition"
            else if (this.ss == 1) this.ss = "Permanent Alert"
            else if (this.ss == 2) this.ss = "Temporary Alert"
            else if (this.ss == 3) this.ss = "SPI Condition"

            //single antenna t/f
            if (bin[39] == "0") this.NICsb = "No"
            else this.NICsb = "Yes"

            this.alt = bin.substring(40, 52)
            let qBit = this.alt[7]
            this.alt = this.alt.substring(0, 7) + this.alt.substring(8)

            if (qBit == "0") {
                this.alt = parseInt(this.alt, 2) * 100 - 1000
            } else {
                this.alt = parseInt(this.alt, 2) * 25 - 1000
            }

            if (bin[53] == "1") {
                this.latCprOdd = parseInt(bin.substring(54, 71), 2) / 131072.0
                this.lonCprOdd = parseInt(bin.substring(71, 88), 2) / 131072.0
                this.tE = parseInt(bin[52], 2)
            } else {
                this.latCprEven = parseInt(bin.substring(54, 71), 2) / 131072.0
                this.lonCprEven = parseInt(bin.substring(71, 88), 2) / 131072.0
                this.tE = parseInt(bin[52], 2)
            }

            //lat
            let j = Math.floor(59 * this.latCprEven - 60 * this.latCprOdd + 0.5)
            let dLatE = 360 / 60.0
            let dLatO = 360 / 59.0

            let latE = dLatE * ((j % 60) + this.latCprEven)
            let latO = dLatO * ((j % 59) + this.latCprOdd)

            if (latE >= 270) latE -= 360
            if (latO >= 270) latO -= 360

            if (this.tE >= this.tO) this.lat = latE
            else this.lat = latO

            //lon
            if (this.tE > this.tO) {
                let nlLatE = Math.floor((2 * Math.PI) / Math.acos(1 - ((1 - Math.cos(Math.PI / 30)) / (Math.cos((Math.PI / 180) * latE) ** 2))))
                let ni = Math.max(nlLatE, 1)
                let dLon = 360 / ni
                let m = Math.floor(this.lonCprEven * (nlLatE - 1) - this.lonCprOdd * nlLatE + 0.5)
                this.lon = dLon * ((m % ni) + this.lonCprEven)
            } else {
                let nlLatO = Math.floor((2 * Math.PI) / Math.acos(1 - ((1 - Math.cos(Math.PI / 30)) / (Math.cos((Math.PI / 180) * latO) ** 2))))
                let ni = Math.max(nlLatO - 1, 1)
                let dLon = 360 / ni
                let m = Math.floor(this.lonCprEven * (nlLatO - 1) - this.lonCprOdd * nlLatO + 0.5)
                let lonTemp = dLon * ((m % ni) + this.lonCprOdd)
                if (lonTemp >= 180) this.lon = lonTemp - 360
                else this.lon = lonTemp
            }
        } else if (tc == 19) {
            this.st = parseInt(bin.substring(37, 40), 2)
            if (this.st == 1 || this.st == 2) {
                this.nac = parseInt(bin.substring(42, 45), 2)

                let sEW = parseInt(bin[45], 2)
                let sNS = parseInt(bin[56], 2)

                let vWE = parseInt(bin.substring(46, 56), 2)
                let vSN = parseInt(bin.substring(57, 67), 2)

                if (sEW == 1) {
                    vWE = -1 * (vWE - 1)
                } else if (sEW == 0) {
                    vWE = vWE - 1
                }

                if (sNS == 1) {
                    vSN = -1 * (vSN - 1)
                } else if (sNS == 0) {
                    vSN = vSN - 1
                }

                this.Gspd = Math.sqrt((vWE ** 2) + (vSN ** 2))
                this.hdg = Math.atan(vWE / vSN) * 360 / (2 * Math.PI)
                if (vWE < 0 && vSN < 0) {
                    this.hdg += 180
                } else if (vWE > 0 && vSN < 0) this.hdg = 180 - this.hdg
                if (this.hdg < 0) this.hdg += 360

                let svr = parseInt(bin[68], 2)

                this.vr = (parseInt(bin.substring(69, 78), 2) - 1) * 64
                if (svr == 1) this.vr *= -1

                this.vrSrc = parseInt(bin[67], 2)
                if (this.vrSrc == 0) this.vrSrc = "Baro-pressure altitude change rate"
                else if (this.vrSrc == 1) this.vrSrc = "Geometric altitude change rate"
            } else if (this.st == 3 || this.st == 4) {
                this.nac = parseInt(bin.substring(42, 45), 2)

                let hs = parseInt(bin[45], 2)
                if (hs == 0) {
                    this.hdg = "Unavailable"
                } else {
                    this.hdg = parseInt(bin.substring(46, 56), 2) / 1024 * 360
                }
                let ast = parseInt(bin[56], 2)
                if (ast == 0) {
                    this.ias = parseInt(bin.substring(57, 67), 2)
                } else {
                    this.tas = parseInt(bin.substring(57, 67), 2)
                }

                let svr = parseInt(bin[68], 2)

                this.vr = (parseInt(bin.substring(69, 78), 2) - 1) * 64
                if (svr == 1) this.vr *= -1

                this.vrSrc = parseInt(bin[67], 2)
                if (this.vrSrc == 0) this.vrSrc = "Baro-pressure altitude change rate"
                else if (this.vrSrc == 1) this.vrSrc = "Geometric altitude change rate"
            }
        }
    }
    getInfo() {
        return {
            "downlink format": this.downlinkFormat,
            "transponder capability": this.xpdrCapability,
            "icao": this.icao,
            "time": this.time,
            "emitter category": this.ec,
            "callsign": this.callsign,
            "surveillance status": this.ss,
            "single antenna": this.NICsb,
            "altitude": this.alt,
            "latitude": this.lat,
            "longitude": this.lon,
            "subtype": this.st,
            "velocity uncertanty": this.nac,
            "ground speed": this.Gspd,
            "heading": this.hdg,
            "vertical rate": this.vr,
            "vertical rate source": this.vrSrc,
            "ias": this.ias,
            "tas": this.tas,
        }
    }
}

let aircraftManager = new Aircrafts()

class Decoder {
    #hex2bin(hexdec) {
        let i = 0;
        let returning = ""

        while (hexdec[i]) {
            switch (hexdec[i]) {
                case '0':
                    returning = returning + "0000";
                    break;
                case '1':
                    returning = returning + "0001";
                    break;
                case '2':
                    returning = returning + "0010";
                    break;
                case '3':
                    returning = returning + "0011";
                    break;
                case '4':
                    returning = returning + "0100";
                    break;
                case '5':
                    returning = returning + "0101";
                    break;
                case '6':
                    returning = returning + "0110";
                    break;
                case '7':
                    returning = returning + "0111";
                    break;
                case '8':
                    returning = returning + "1000";
                    break;
                case '9':
                    returning = returning + "1001";
                    break;
                case 'A':
                case 'a':
                    returning = returning + "1010";
                    break;
                case 'B':
                case 'b':
                    returning = returning + "1011";
                    break;
                case 'C':
                case 'c':
                    returning = returning + "1100";
                    break;
                case 'D':
                case 'd':
                    returning = returning + "1101";
                    break;
                case 'E':
                case 'e':
                    returning = returning + "1110";
                    break;
                case 'F':
                case 'f':
                    returning = returning + "1111";
                    break;
            }
            i++;
        }
        return returning
    }

    decode(buffer) {
        for (let i in buffer) {
            if (buffer.length < 1) continue
            let bin = this.#hex2bin(buffer[i])
            let downlinkFormat = parseInt(bin.substring(0, 5), 2)
            if (downlinkFormat != 17) continue

            downlinkFormat = "ADS-B"
            let xpdrCapability = parseInt(bin.substring(5, 8), 2)
            if (xpdrCapability == 0) xpdrCapability = "(lvl 1)"
            else if (xpdrCapability == 4) xpdrCapability = "on-ground (lvl 2+)"
            else if (xpdrCapability == 5) xpdrCapability = "airborn (lvl 2+)"
            else if (xpdrCapability == 6) xpdrCapability = "on-ground or airborn (lvl 2+)"
            else if (xpdrCapability == 7) xpdrCapability = "on-ground or airborn (?)"

            let icao = parseInt(bin.substring(8, 32), 2).toString(16)
            let meTC = parseInt(bin.substring(32, 37), 2)
            let me = bin.substring(37, 88)
            let found = false
            for (i in aircraftManager.contactList) {
                if (aircraftManager.contactList[i].icao == icao) {
                    found = true
                    aircraftManager.contactList[i].updateInfo(meTC, me, bin)
                }
            }
            if (!found) {
                aircraftManager.addContact(new Contact(downlinkFormat, xpdrCapability, icao))
            }
        }
    }
}

let that

class Server {
    constructor() {
        that = this
    }
    getBestMatch(lat, lon, alt, el, az) {
        let aircraftInRange = []
        let elAzDistanceCalculator = new ElAzCalc()
        for (let i in aircraftManager.contactList) {
            let elAzDistance = elAzDistanceCalculator.calculate(lat, lon, aircraftManager.contactList[i].lat, aircraftManager.contactList[i].lon, alt, aircraftManager.contactList[i].alt)
            if (elAzDistance[0] < 80) {
                aircraftInRange.push([aircraftManager.contactList[i], elAzDistance])
            }
        }
        let bestMatch = [null, null, Number.MAX_SAFE_INTEGER]
        if (aircraftInRange) {
            for (let i in aircraftInRange) {
                let score = Math.sqrt(Math.abs(el - aircraftInRange[i][1][2]) ** 2) + (Math.abs(az - aircraftInRange[i][1][1]) ** 2)
                if (score < bestMatch[2]) {
                    console.log(bestMatch)
                    aircraftInRange[i].push(score)
                    bestMatch = aircraftInRange[i]
                }
            }
            return bestMatch[0].getInfo()
        } else {
            return "No Aircraft Detected"
        }
    }
    createServer(serverUrl) {
        this.server = http.createServer(function (req, res) {
            const { method, url } = req;
            let surl = new URL(url, serverUrl);

            if (method == 'GET' && surl.pathname == '/scan') {
                let params = surl.searchParams
                let lat = params.get("lat")
                let lon = params.get("lon")
                let alt = params.get("alt")

                let el = params.get("el")
                let az = params.get("az")

                res.write(JSON.stringify(that.getBestMatch(lat, lon, alt, el, az)))
                res.end()
                return
            }
        })
    }

}

let decoder = new Decoder()

client.on('data', function (data) {
    let packets = data.toString().replace(/\n|\*/g, "").split(";")
    decoder.decode(packets)
})

let server = new Server()
server.createServer("http://10.0.0.211/")
server.server.listen(80)

client.on('close', function () {
    console.log('Connection closed');
});