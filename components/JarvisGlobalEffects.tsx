import { useJarvis } from '../contexts/JarvisContext';
import JarvisEdgeGlow from './BottomBar/JarvisEdgeGlow';

/**
 * Global component that renders Jarvis visual effects across the entire app.
 * This should be added at the root layout level.
 */
export default function JarvisGlobalEffects() {
  const { jarvisActive } = useJarvis();

  return <JarvisEdgeGlow active={jarvisActive} />;
}
