import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>LifeOS</Text>
      <Text style={styles.subtitle}>Your Digital Life Architect</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#A8A8C0',
    fontSize: 17,
    marginTop: 8,
  },
});
