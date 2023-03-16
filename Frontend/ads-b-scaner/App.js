//Importing dependancies
import { StatusBar } from 'expo-status-bar'
import { Camera, CameraType } from 'expo-camera';
import React, { useState, useEffect, useRef } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, ScrollView, View, ActivityIndicator, Dimensions } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'

//getting user screen dimenstions
const width = Dimensions.get('window').width
const height = Dimensions.get('window').height

//{server}:{port}
//(asuming http)
const serverIP = "10.0.0.211:80"

//ssl t/f
const ssl = false

export default function App() {
    //setting states
    const sslS = ssl ? "s" : ""
    const cameraRef = useRef()
    const [hasCameraPermission, setHasCameraPermission] = useState()
    const [location, setLocation] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [toShowInfo, setToShowInfo] = useState(false)
    const [toShow, setToShow] = useState(false)
    const [status, requestPermission] = Location.useForegroundPermissions()
    const [data, setData] = useState({})
    const [info, setInfo] = useState(null)
    const [isNoResults, setIsNoResults] = useState(false)
    const [displayingInfo, setDisplayingInfo] = useState(false)

    //getting location and camera permissions
    useEffect(() => {
        _subscribe();
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync()
            const cameraPermission = await Camera.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied')
                return
            }
            let location = await Location.getCurrentPositionAsync({})
            setLocation(location.coords)

            let locations = await Location.watchPositionAsync({
                accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000
            },
                (loc) => { setLocation(loc.coords) })
            setHasCameraPermission(cameraPermission.status === "granted");
        })()
        return () => {
            _unsubscribe() //Unsubscribe Function
        }
    }, [])

    //setting refresh rate from device sensors
    const _setInterval = () => {
        DeviceMotion.setUpdateInterval(77);
    };

    //subscribing to device motion sensor's data
    const _subscribe = () => {
        //Adding the Listener
        DeviceMotion.addListener((devicemotionData) => {
            setData(devicemotionData.rotation)
        })
        //Calling setInterval Function after adding the listener
        _setInterval();
    }

    const _unsubscribe = () => {
        //Removing all the listeners at end of screen unload
        DeviceMotion.removeAllListeners()
    }

    //calculating angle of azimuth of device
    function getAz() {
        if (data) {
            return (data.alpha * (180 / Math.PI)) < 0 ? 180 + Math.abs((data.alpha * (180 / Math.PI))) : Math.abs(Math.abs((data.alpha * (180 / Math.PI))) - 180)
        } else {
            return null
        }
    }

    //calculating angle of elevation of device
    function getEl() {
        if (data) {
            return 90 - (data.beta * (180 / Math.PI))
        } else {
            return null
        }
    }

    //getting location of device and converting altitude of device form meters to feet
    function getLoc() {
        if (location) {
            if (location.latitude && location.longitude && location.altitude) {
                let altMeters = location.altitude * 3.281
                return [location.latitude, location.longitude, altMeters]
            } else {
                return [null, null, null]
            }
        } else {
            return [null, null, null]
        }
    }

    function getMatch() {
        //getting device angles
        setIsLoading(true)
        let az = getAz()
        let el = getEl()
        let locArr = getLoc()

        //sending api request
        fetch(`http${sslS}://${serverIP}/scan?lat=${locArr[0]}&lon=${locArr[1]}&${locArr[2]}&el=${el}&az=${az}`)
            .then(res => res.json())
            .then(json => {
                if (json == "none") {
                    setIsNoResults(true)
                    setToShowInfo(true)
                    setIsLoading(false)
                    setDisplayingInfo(true)
                    return
                }
                setInfo(json)
                setToShow(true)
                setToShowInfo(true)
                setIsLoading(false)
                setDisplayingInfo(true)
            })
    }

    //restarting UI
    function scanAgain() {
        setDisplayingInfo(false)
        setToShow(false)
        setToShowInfo(false)
        setIsNoResults(false)
    }

    //UI JSX
    return (
        <ScrollView style={styles.scroll}>
            {isLoading &&
                <ActivityIndicator size="large" style={styles.loading} color="white" borderColor="black" borderWidth={5} backgroundColor="transparent" />
            }
            {!toShowInfo &&
                <Text style={styles.textT}>Point your device at an aircraft and scan it to identify...</Text>
            }
            {!displayingInfo &&
                <Camera style={styles.camera}>
                </Camera>
            }
            {!displayingInfo &&
                <TouchableOpacity onPress={getMatch} style={styles.button}>
                    <Text style={styles.text}>Scan</Text>
                </TouchableOpacity>
            }
            <ScrollView style={styles.scroll2}>
                {isNoResults &&
                    <Text style={styles.info}>No Aircraft Detected</Text>
                }
                {toShow &&
                    <View style={styles.dataText}>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>HEX:</Text><Text style={styles.data}>{info["icao"].toUpperCase()}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Callsign:{"\n"} <Text style={styles.data}>{!info["callsign"] ? "N/A" : info["callsign"]}</Text></Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Type:{"\n"}<Text style={styles.data2}>{!info["type"] ? "N/A" : info["type"]}</Text></Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Reg:{"\n"} <Text style={styles.data}>{!info["registration"] ? "N/A" : info["registration"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        {/* data2 */}
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Altitude:{"\n"} <Text style={styles.data}>{info["altitude"]} ft</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Groundspeed:{"\n"} <Text style={styles.data}>{Math.round(info["ground speed"])} kts</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        {/* data3 */}
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Lat, Lon:{"\n"} <Text style={styles.data2}>{info["latitude"].toFixed(3)}°, {info["longitude"].toFixed(3)}°</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Heading:{"\n"} <Text style={styles.data}>{Math.round(info["heading"])}°</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Vertical Rate:{"\n"} <Text style={styles.data}>{info["vertical rate"]} ft/m</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Emitter Category:{"\n"} <Text style={styles.data}>{info["emitter category"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Manufacturer:{"\n"} <Text style={styles.data}>{!info["manufacturer"] ? "N/A" : info["manufacturer"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Owners:{"\n"} <Text style={styles.data2}>{!info["registered owners"] ? "N/A" : info["registered owners"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        {/* data4 */}
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Downlink Format:{"\n"} <Text style={styles.data}>{info["downlink format"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Transponder Capability:{"\n"} <Text style={styles.data2}>{info["transponder capability"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Time:{"\n"} <Text style={styles.data2}>{new Date(info["time"]).toString()}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Surveillance Status:{"\n"} <Text style={styles.data2}>{info["surveillance status"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Single Antenna:{"\n"} <Text style={styles.data}>{info["single antenna"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Subtype:{"\n"} <Text style={styles.data}>{info["subtype"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Velocity Uncertanty:{"\n"} <Text style={styles.data}>{info["velocity uncertanty"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Vertical Rate Source:{"\n"} <Text style={styles.data2}>{info["vertical rate source"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>IAS:{"\n"} <Text style={styles.data}>{!info["ias"] ? "N/A" : info["ias"] + " kts"}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>TAS:{"\n"} <Text style={styles.data}>{!info["tas"] ? "N/A" : info["tas"] + " kts"}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>Operator Flag Code:{"\n"} <Text style={styles.data2}>{!info["registered owners"] ? "N/A" : info["registered owners"]}</Text>{"\n"}</Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                    </View>
                }
                {displayingInfo &&
                    <TouchableOpacity onPress={scanAgain} style={styles.button}>
                        <Text style={styles.text2}>Scan Again</Text>
                    </TouchableOpacity>
                }
                <StatusBar style="auto" />
            </ScrollView>
        </ScrollView>
    )
}
//Styling for UI
const styles = StyleSheet.create({
    sperator: {
        fontSize: 5
    },
    dataText: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
    },
    scroll: {
        paddingTop: 40,
        flex: 1,
        flexGrow: 1,
        display: 'flex',
        backgroundColor: '#FAF6F8'
    },
    scroll2: {
        display: "flex",
        flexGrow: 1,
    },
    button: {
        justifyContent: 'center',
        alignItems: 'center',
        width: width,
        height: height * 0.22,
        padding: 10,
        paddingBottom: 30,
        borderRadius: 30,
        backgroundColor: '#b3b3b3',
    },
    container: {
        paddingLeft: 30,
        paddingRight: 30,
        marginTop: 35,
        paddingBottom: 136,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textT: {
        paddingLeft: 30,
        paddingRight: 30,
        paddingBottom: 30,
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
    },
    text: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
    },
    text2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 20,
    },
    infoDiv: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: 150,
        marginLeft: 100,
        marginRight: 100,
    },
    info: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 35,
        paddingLeft: 40,
        paddingTop: 10
    },
    info2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
    },
    info3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 20,
    },
    info4: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 13,
    },
    data: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 65,
        color: '#F4717F',
        textAlign: 'center',
    },
    data2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 40,
        color: '#F4717F',
        textAlign: 'center',
    },
    data3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 20,
        color: '#858585'
    },
    data4: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 13,
        color: '#858585'
    },
    loading: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        color: "white",
        borderColor: "black",
        borderWidth: 5,
        transform: [{ scaleX: 2 }, { scaleY: 2 }],
        zIndex: 99
    },
    camera: {
        flexGrow: 1,
        alignItems: 'center',
        aspectRatio: 3 / 4,
        justifyContent: 'center',
    }
});