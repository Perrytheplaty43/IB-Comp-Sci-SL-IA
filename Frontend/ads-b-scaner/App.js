import { StatusBar } from 'expo-status-bar'
import React, { useState, useEffect } from 'react'
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'

export default function App() {

    const [location, setLocation] = useState(null)
    const [status, requestPermission] = Location.useForegroundPermissions()
    const [data, setData] = useState({})

    useEffect(() => {
        _subscribe()
        (async () => {

            let { status } = await Location.requestForegroundPermissionsAsync()
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
        })()
        return () => {
            _unsubscribe() //Unsubscribe Function
        }
    }, [])

    const _setInterval = () => {
        DeviceMotion.setUpdateInterval(77)
    }

    const _subscribe = () => {
        //Adding the Listener
        DeviceMotion.addListener((devicemotionData) => {
            setData(devicemotionData.rotation)
        })
        //Calling setInterval Function after adding the listener
        _setInterval()
    }

    const _unsubscribe = () => {
        //Removing all the listeners at end of screen unload
        DeviceMotion.removeAllListeners()
    }

    function getAz() {
        return (data.alpha * (180 / Math.PI)) < 0 ? 180 + Math.abs((data.alpha * (180 / Math.PI))) : Math.abs(Math.abs((data.alpha * (180 / Math.PI))) - 180)
    }

    function getEl() {
        return 90 - (data.beta * (180 / Math.PI))
    }

    function getLoc() {
        if (location) {
            return [location.latitude, location.longitude, location.altitude]
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Point your mobile device at an aircraft to identify it and receive its information...</Text>
            <Text style={styles.gyro}>az: {getAz()}</Text>
            <Text style={styles.gyro}>el: {getEl()}</Text>
            <Text style={styles.gyro}>loc: {getLoc()[0]}, {getLoc()[1]}, {getLoc()[2]}</Text>
            <Button title='Scan' />
            <StatusBar style="auto" />
        </View>
    )
}
const styles = StyleSheet.create({
    container: {
        marginLeft: 50,
        marginRight: 50,
        marginTop: 100,
    },
    text: {
        fontFamily: 'Roboto',
        fontWeight: 900,
        fontSize: 30,
    }
})