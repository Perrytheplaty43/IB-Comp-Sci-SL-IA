import { StatusBar } from 'expo-status-bar'
import { Camera, CameraType } from 'expo-camera';
import React, { useState, useEffect, useRef } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'

export default function App() {
    let cameraRef = useRef()
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

    const _setInterval = () => {
        DeviceMotion.setUpdateInterval(77);
    };

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

    function getAz() {
        if (data) {
            return (data.alpha * (180 / Math.PI)) < 0 ? 180 + Math.abs((data.alpha * (180 / Math.PI))) : Math.abs(Math.abs((data.alpha * (180 / Math.PI))) - 180)
        } else {
            return null
        }
    }

    function getEl() {
        if (data) {
            return 90 - (data.beta * (180 / Math.PI))
        } else {
            return null
        }
    }

    function getLoc() {
        //TODO: convert alt from meters to feet for the api
        if (location) {
            if (location.latitude && location.longitude && location.altitude) {
                return [location.latitude, location.longitude, location.altitude]
            } else {
                return [null, null, null]
            }
        } else {
            return [null, null, null]
        }
    }

    function getMatch() {
        setIsLoading(true)
        let az = getAz()
        let el = getEl()
        let locArr = getLoc()

        fetch(`http://10.0.0.211:80/scan?lat=${locArr[0]}&lon=${locArr[1]}&${locArr[2]}&el=${el}&az=${az}`)
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

    function scanAgain() {
        setDisplayingInfo(false)
        setToShow(false)
        setToShowInfo(false)
        setIsNoResults(false)
    }

    return (
        <View style={styles.container}>
            {isLoading &&
                <ActivityIndicator size="large" style={styles.loading} color={"#242424"} />
            }
            {!toShowInfo &&
                <Text style={styles.text}>Point your mobile device at an aircraft to identify it and receive its information...</Text>
            }
            {/* <Text style={styles.gyro}>az: {getAz()}</Text>
            <Text style={styles.gyro}>el: {getEl()}</Text>
            <Text style={styles.gyro}>loc: {getLoc()[0]}, {getLoc()[1]}, {getLoc()[2]}</Text> */}
            {!displayingInfo &&
                <Camera style={styles.camera}>
                </Camera>
            }
            {isNoResults &&
                <Text style={styles.info}>No Aircraft Detected</Text>
            }
            {toShow &&
                <Text>
                    <Text style={styles.info}>
                        HEX: <Text style={styles.data}>{info["icao"]}</Text>{"\n"}
                        Callsign: <Text style={styles.data}>{!info["callsign"] ? "N/A" : info["callsign"]}</Text>{"\n"}
                    </Text>
                    {"\n"}
                    <Text style={styles.info2}>
                        Altitude: <Text style={styles.data2}>{info["altitude"]} ft</Text>{"\n"}
                        Groundspeed: <Text style={styles.data2}>{Math.round(info["ground speed"])} kts</Text>{"\n"}
                    </Text>
                    {"\n"}
                    {"\n"}
                    <Text style={styles.info3}>
                        Lat, Lon: <Text style={styles.data3}>{info["latitude"].toFixed(3)}°, {info["longitude"].toFixed(3)}°</Text>{"\n"}
                        Heading: <Text style={styles.data3}>{Math.round(info["heading"])}°</Text>{"\n"}
                        Vertical Rate: <Text style={styles.data3}>{info["vertical rate"]} ft/m</Text>{"\n"}
                        Emitter Category: <Text style={styles.data3}>{info["emitter category"]}</Text>{"\n"}
                    </Text>
                    {"\n"}
                    {"\n"}
                    <Text style={styles.info4}>
                        Downlink Format: <Text style={styles.data4}>{info["downlink format"]}</Text>{"\n"}
                        Transponder Capability: <Text style={styles.data4}>{info["transponder capability"]}</Text>{"\n"}
                        Time: <Text style={styles.data4}>{new Date(info["time"]).toString()}</Text>{"\n"}
                        Surveillance Status: <Text style={styles.data4}>{info["surveillance status"]}</Text>{"\n"}
                        Single Antenna: <Text style={styles.data4}>{info["single antenna"]}</Text>{"\n"}
                        Subtype: <Text style={styles.data4}>{info["subtype"]}</Text>{"\n"}
                        Velocity Uncertanty: <Text style={styles.data4}>{info["velocity uncertanty"]}</Text>{"\n"}
                        Vertical Rate Source: <Text style={styles.data4}>{info["vertical rate source"]}</Text>{"\n"}
                        IAS: <Text style={styles.data4}>{!info["ias"] ? "N/A" : info["ias"] + " kts"}</Text>{"\n"}
                        TAS: <Text style={styles.data4}>{!info["tas"] ? "N/A" : info["tas"] + " kts"}</Text>{"\n"}
                    </Text>
                </Text>
            }
            {!displayingInfo &&
                <TouchableOpacity onPress={getMatch} style={styles.button}>
                    <Text style={styles.text}>Scan</Text>
                </TouchableOpacity>
            }
            {displayingInfo &&
                <TouchableOpacity onPress={scanAgain} style={styles.button}>
                    <Text style={styles.text2}>Scan Again</Text>
                </TouchableOpacity>
            }
            <StatusBar style="auto" />
        </View>
    )
}
const styles = StyleSheet.create({
    button: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: 30,
        padding: 10,
        zIndex: 100,
        marginBottom: 15,
        borderRadius: 100,
        backgroundColor: '#dbdbdb',
    },
    container: {
        paddingLeft: 30,
        paddingRight: 30,
        marginTop: 50,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    info: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 40,
    },
    info2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 35,
    },
    info3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 25,
    },
    info4: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 15,
    },
    data: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 40,
        color: '#858585'
    },
    data2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 35,
        color: '#858585'
    },
    data3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 25,
        color: '#858585'
    },
    data4: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 15,
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
        transform: [{ scaleX: 2 }, { scaleY: 2 }]
    },
    camera: {
        flexGrow: 1,
        alignItems: 'center',
        aspectRatio: 3 / 4,
        marginBottom: 20,
        marginLeft: 20,
        marginRight: 20,
        justifyContent: 'center',
    }
});