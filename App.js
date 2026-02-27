import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen'; // Adjust paths if necessary
import AddTaskScreen from './screens/AddTaskScreen'; // Adjust paths if necessary

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        // 👇 THIS IS THE MAGIC LINE TO REMOVE THE WHITE BAR
        screenOptions={{ 
          headerShown: false,
          animation: 'fade', // Optional: adds a smooth fade transition between screens
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddTask" component={AddTaskScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}