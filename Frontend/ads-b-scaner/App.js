//Importing dependancies
import { StatusBar } from 'expo-status-bar'
import { Camera, CameraType } from 'expo-camera';
import React, { useState, useEffect, useRef } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, ScrollView, View, ActivityIndicator, Dimensions, Image, Animated, TouchableHighlight } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'

//getting user screen dimenstions
const width = Dimensions.get('window').width
const height = Dimensions.get('window').height

//{server}:{port}
//(asuming http)
const serverIP = "73.169.132.52:81"

//ssl t/f
const ssl = false

let infoG = {"image": "none"}

let animatedValue = new Animated.Value(0)

export default function App() {
    //setting states
    const sslS = ssl ? "s" : ""
    const cameraRef = useRef()
    const [hasCameraPermission, setHasCameraPermission] = useState()
    const [toShow2, setToShow2] = useState(false)
    const [location, setLocation] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [toShowInfo, setToShowInfo] = useState(false)
    const [toShow, setToShow] = useState(false)
    const [status, requestPermission] = Location.useForegroundPermissions()
    const [data, setData] = useState({})
    const [info, setInfo] = useState({})
    const [isNoResults, setIsNoResults] = useState(false)
    const [displayingInfo, setDisplayingInfo] = useState(false)

    const fadeAnim = useRef(new Animated.Value(0)).current

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
        console.log(el, az)
        fetch(`http${sslS}://${serverIP}/scan?lat=${locArr[0]}&lon=${locArr[1]}&alt=${locArr[2]}&el=${el}&az=${az}`)
            .then(res => res.json())
            .then(json => {
                infoG = json
                if (json == "none") {
                    setIsNoResults(true)
                    setToShowInfo(true)
                    setIsLoading(false)
                    setDisplayingInfo(true)
                    loadingColor = '#554C4E'
                    setInfo(json)
                    return
                }
                setInfo(json)
                setToShow(true)
                setToShowInfo(true)
                setDisplayingInfo(true)
                if (json["image"] == "none") {
                    setIsLoading(false)
                }
            })
    }

    //restarting UI
    function scanAgain() {
        setDisplayingInfo(false)
        setToShow(false)
        setToShowInfo(false)
        setIsNoResults(false)
        setToShow2(false)
        fadeAnim.setValue(0)
    }

    function showAllInfo() {
        setToShow(false)
        setToShow2(true)
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }

    function imagesOnLoad() {
        setIsLoading(false)
    }

    //UI JSX
    return (
        <ScrollView style={styles.scroll}>
            {isLoading &&
                <ActivityIndicator size="large" style={styles.loading} color='#F4717F' backgroundColor="transparent" />
            }
            {!toShowInfo &&
                <View style={styles.infoDiv5}>
                    <Text style={styles.textT}>Point your device at an aircraft and scan it to identify it...</Text>
                </View>
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
                {toShow &&
                    <View style={styles.dataText}>
                        <TouchableOpacity onPress={showAllInfo}>
                            <View style={styles.infoDiv6}>
                                <Text style={styles.infoB}>AIRCRAFT DETAILS</Text>
                                <Text style={styles.dataB}>{!info["registration"] ? (!info["callsign"] ? "Unknown" : info["callsign"]) : info["registration"]}</Text>
                                {info["image"] != "none" &&
                                    <Image style={styles.image} source={{ uri: info["image"] }} onLoad={imagesOnLoad}></Image>
                                }
                                <Text style={styles.infoB}>{info["image"] != "none" ? "Tap aircraft to see more information..." : "Tap to see more information"}</Text>
                            </View>
                        </TouchableOpacity >
                    </View>
                }
                {toShow2 &&
                    <Animated.View style={{
                        alignItems: 'center',
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 20,
                        transform: [{ scaleX: fadeAnim }, { scaleY: fadeAnim }]
                    }}>
                        <View style={styles.infoDiv}>
                            <Text style={styles.info}>HEX: <Text style={styles.data}>{info["icao"].toUpperCase()}</Text></Text>
                            <Text style={styles.info}>Callsign: <Text style={styles.data}>{!info["callsign"] ? "N/A" : info["callsign"]}</Text></Text>
                            <Text style={styles.info}>Type: <Text style={styles.data}>{!info["type"] ? "N/A" : info["type"]}</Text></Text>
                            <Text style={styles.info}>Reg: <Text style={styles.data}>{!info["registration"] ? "N/A" : info["registration"]}</Text></Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>
                        {/* data2 */}
                        <View style={styles.infoDiv2}>
                            <Text style={styles.info2}>Altitude: <Text style={styles.data}>{info["altitude"]} ft</Text></Text>
                            <Text style={styles.info2}>Groundspeed: <Text style={styles.data}>{Math.round(info["ground speed"])} kts</Text></Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        {/* data3 */}
                        <View style={styles.infoDiv3}>
                            <Text style={styles.info2}>Lat, Lon: <Text style={styles.data2}>{info["latitude"].toFixed(3)}°, {info["longitude"].toFixed(3)}°</Text></Text>
                            <Text style={styles.info2}>Heading: <Text style={styles.data2}>{Math.round(info["heading"])}°</Text></Text>
                            <Text style={styles.info2}>Vertical Rate: <Text style={styles.data2}>{info["vertical rate"]} ft/m</Text></Text>
                            <Text style={styles.info2}>Emitter Category: <Text style={styles.data2}>{info["emitter category"]}</Text></Text>
                            <Text style={styles.info2}>Manufacturer: <Text style={styles.data2}>{!info["manufacturer"] ? "N/A" : info["manufacturer"]}</Text></Text>
                            <Text style={styles.info2}>Owners: <Text style={styles.data2}>{!info["registered owners"] ? "N/A" : info["registered owners"]}</Text></Text>
                        </View>
                        <Text style={styles.sperator}>{"\n"}</Text>

                        {/* data4 */}
                        {/* <View style={styles.infoDiv4}>
                            <Text style={styles.info3}>Downlink Format: <Text style={styles.data3}>{info["downlink format"]}</Text></Text>
                            <Text style={styles.info3}>Transponder Capability: <Text style={styles.data3}>{info["transponder capability"]}</Text></Text>
                            <Text style={styles.info3}>Time: <Text style={styles.data3}>{new Date(info["time"]).toString()}</Text></Text>
                            <Text style={styles.info3}>Surveillance Status: <Text style={styles.data3}>{info["surveillance status"]}</Text></Text>
                            <Text style={styles.info3}>Single Antenna: <Text style={styles.data3}>{info["single antenna"]}</Text></Text>
                            <Text style={styles.info3}>Subtype: <Text style={styles.data3}>{info["subtype"]}</Text></Text>
                            <Text style={styles.info3}>Velocity Uncertanty: <Text style={styles.data3}>{info["velocity uncertanty"]}</Text></Text>
                            <Text style={styles.info3}>Vertical Rate Source: <Text style={styles.data3}>{info["vertical rate source"]}</Text></Text>
                            <Text style={styles.info3}>IAS: <Text style={styles.data3}>{!info["ias"] ? "N/A" : info["ias"] + " kts"}</Text></Text>
                            <Text style={styles.info3}>TAS: <Text style={styles.data3}>{!info["tas"] ? "N/A" : info["tas"] + " kts"}</Text></Text>
                            <Text style={styles.info3}>Operator Flag Code: <Text style={styles.data3}>{!info["registered owners"] ? "N/A" : info["registered owners"]}</Text></Text>
                        </View> */}
                    </Animated.View>
                }
                {isNoResults &&
                    <Text style={styles.info}>No Aircraft Detected</Text>
                }
                {(displayingInfo && !toShow2 && info != 'none' && info["image"] != 'none') &&
                    <TouchableOpacity onPress={scanAgain} style={styles.buttonSA}>
                        <Text style={styles.text2}>Scan Again</Text>
                    </TouchableOpacity>
                }
                {(displayingInfo && !toShow2 && info["image"] == 'none') &&
                    <TouchableOpacity onPress={scanAgain} style={styles.buttonSA4}>
                        <Text style={styles.text2}>Scan Again</Text>
                    </TouchableOpacity>
                }
                {(displayingInfo && toShow2) &&
                    <TouchableOpacity onPress={scanAgain} style={styles.buttonSA2}>
                        <Text style={styles.text2}>Scan Again</Text>
                    </TouchableOpacity>
                }
                <StatusBar style="auto" />
                {(displayingInfo && !toShow2 && info == 'none') &&
                    <TouchableOpacity onPress={scanAgain} style={styles.buttonSA3}>
                        <Text style={styles.text2}>Scan Again</Text>
                    </TouchableOpacity>
                }
            </ScrollView>
        </ScrollView>
    )
}
//Styling for UI
const styles = StyleSheet.create({
    image: {
        width: width - 20,
        overflow: 'hidden',
        borderRadius: 30,
        marginTop: 100,
        marginBottom: 100,
        aspectRatio: 16 / 9
    },
    sperator: {
        fontSize: 5
    },
    dataText: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 20
    },
    dataTextA: {
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 200,
        transform: [
            {
                scaleX: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 15]
                })
            },
            {
                scaleY: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 12.5]
                })
            }
        ]
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
        backgroundColor: '#DBD8D8',
    },
    buttonSA: {
        justifyContent: 'center',
        alignItems: 'center',
        position: "relative",
        bottom: 0,
        width: width,
        height: height * 0.15,
        borderRadius: 30,
        backgroundColor: '#DBD8D8',
    },
    buttonSA2: {
        justifyContent: 'center',
        alignItems: 'center',
        width: width,
        height: height * 0.15,
        marginTop: 5,
        borderRadius: 30,
        backgroundColor: '#DBD8D8',
    },
    buttonSA3: {
        justifyContent: 'center',
        alignItems: 'center',
        position: "relative",
        width: width,
        height: height * 0.15,
        borderRadius: 30,
        backgroundColor: '#DBD8D8',
        marginTop: height - 170
    },
    buttonSA4: {
        justifyContent: 'center',
        alignItems: 'center',
        position: "relative",
        width: width,
        height: height * 0.15,
        borderRadius: 30,
        backgroundColor: '#DBD8D8',
        marginTop: height - 845
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
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
    },
    text: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
        color: '#F4717F'
    },
    text2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
        color: '#F4717F'
    },
    infoDiv: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: 240,
        marginLeft: 100,
        marginRight: 100,
    },
    infoDiv6: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: height - 140,
        marginLeft: 100,
        marginRight: 100,
    },
    infoDiv2: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: 110,
        marginLeft: 100,
        marginRight: 100,
    },
    infoDiv3: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: 310,
        marginLeft: 100,
        marginRight: 100,
    },
    infoDiv4: {
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width - 20,
        height: 420,
        marginLeft: 100,
        marginRight: 100,
    },
    infoDiv5: {
        paddingTop: 10,
        backgroundColor: '#DBD8D8',
        borderRadius: 15,
        width: width,
        height: 130,
        marginBottom: 10
    },
    infoB: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 35,
        paddingLeft: 40,
        paddingTop: 10
    },
    info: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 30,
        paddingLeft: 40,
        paddingTop: 10
    },
    infoS: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 25,
        paddingLeft: 40,
        paddingTop: 10
    },
    info2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 25,
        paddingLeft: 40,
        paddingTop: 10
    },
    info3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        color: '#554C4E',
        fontSize: 18,
        paddingLeft: 40,
        paddingTop: 10
    },
    info4: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 13,
    },
    data: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
        color: '#F4717F',
        textAlign: 'center',
    },
    dataB: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 65,
        color: '#F4717F',
        textAlign: 'center',
    },
    data2: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 25,
        color: '#F4717F',
        textAlign: 'center',
    },
    data3: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 15,
        color: '#F4717F',
        textAlign: 'center',
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