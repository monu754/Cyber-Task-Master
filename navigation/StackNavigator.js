import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import AddTaskScreen from '../screens/AddTaskScreen';

// This creates the engine for our screen stacking
const Stack = createNativeStackNavigator();

export default function StackNavigator() {
  return (
    <Stack.Navigator>
      {/* The first screen in the list is always the default starting screen */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="AddTask" component={AddTaskScreen} />
    </Stack.Navigator>
  );
}