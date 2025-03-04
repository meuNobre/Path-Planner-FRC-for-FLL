import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Image, Line, Circle, Rect, Group, Text } from "react-konva";
import { Button, Slider, FormControlLabel, Switch, Paper, Box, Typography, IconButton, Tooltip, Grid, TextField } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import GridOnIcon from "@mui/icons-material/GridOn";
import GridOffIcon from "@mui/icons-material/GridOff";
import SaveIcon from "@mui/icons-material/Save";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import SettingsIcon from "@mui/icons-material/Settings";
import UndoIcon from "@mui/icons-material/Undo";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import '@fontsource-variable/rubik';


// Custom hook to load image
function useImage(src) {
  const [image, setImage] = useState(null);
  
  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);
  
  return [image];
}

export default function FLLPathPlanner() {
  // States
  const [image] = useImage("/tapete_fll.png"); // Replace with your FLL mat image
  const [waypoints, setWaypoints] = useState([]);
  const [simulation, setSimulation] = useState({
    isRunning: false,
    currentPosition: null,
    progress: 0,
    speed: 1.0
  });
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState(null);
  const [settings, setSettings] = useState({
    showGrid: true,
    snapToGrid: true,
    gridSize: 20, // pixels
    showCoordinates: true,
    pathType: "spline", // "line" or "spline"
    pathThickness: 3,
    waypointRadius: 8,
    showDirectionArrows: true
  });
  const [fieldDimensions, setFieldDimensions] = useState({
    width: 800,
    height: 600,
    realWidth: 14, // in FLL field units (e.g., feet)
    realHeight: 8  // in FLL field units
  });

  const animationRef = useRef(null);
  const stageRef = useRef(null);

  // Add waypoint
  const addWaypoint = (event) => {
    if (simulation.isRunning) return;
    
    const stage = event.target.getStage();
    const pointer = stage.getPointerPosition();
    let x = pointer.x;
    let y = pointer.y;
    
    if (settings.snapToGrid) {
      x = Math.round(x / settings.gridSize) * settings.gridSize;
      y = Math.round(y / settings.gridSize) * settings.gridSize;
    }
    
    const realCoords = pixelToRealCoordinates(x, y);
    
    setWaypoints([...waypoints, {
      x,
      y,
      realX: realCoords.x,
      realY: realCoords.y,
      angle: waypoints.length > 0 ? calculateAngle(waypoints[waypoints.length-1], {x, y}) : 0,
      speed: 1.0
    }]);
  };

  // Convert pixel coordinates to real field coordinates
  const pixelToRealCoordinates = (pixelX, pixelY) => {
    return {
      x: parseFloat((pixelX / fieldDimensions.width * fieldDimensions.realWidth).toFixed(2)),
      y: parseFloat(((fieldDimensions.height - pixelY) / fieldDimensions.height * fieldDimensions.realHeight).toFixed(2))
    };
  };

  // Convert real coordinates to pixel coordinates
  const realToPixelCoordinates = (realX, realY) => {
    return {
      x: realX / fieldDimensions.realWidth * fieldDimensions.width,
      y: fieldDimensions.height - (realY / fieldDimensions.realHeight * fieldDimensions.height)
    };
  };

  // Calculate angle between two points
  const calculateAngle = (point1, point2) => {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
  };

  // Delete last waypoint
  const undoLastWaypoint = () => {
    if (waypoints.length > 0) {
      setWaypoints(waypoints.slice(0, -1));
    }
  };

  // Delete all waypoints
  const clearAllWaypoints = () => {
    setWaypoints([]);
    stopSimulation();
  };

  // Handle waypoint drag
  const handleWaypointDrag = (index, e) => {
    const updatedWaypoints = [...waypoints];
    let x = e.target.x();
    let y = e.target.y();
    
    if (settings.snapToGrid) {
      x = Math.round(x / settings.gridSize) * settings.gridSize;
      y = Math.round(y / settings.gridSize) * settings.gridSize;
      e.target.position({ x, y });
    }
    
    const realCoords = pixelToRealCoordinates(x, y);
    
    updatedWaypoints[index] = {
      ...updatedWaypoints[index],
      x,
      y,
      realX: realCoords.x,
      realY: realCoords.y
    };
    
    // Update angles for connected waypoints
    if (index > 0) {
      updatedWaypoints[index-1].angle = calculateAngle(
        updatedWaypoints[index-1], 
        updatedWaypoints[index]
      );
    }
    if (index < updatedWaypoints.length - 1) {
      updatedWaypoints[index].angle = calculateAngle(
        updatedWaypoints[index], 
        updatedWaypoints[index+1]
      );
    }
    
    setWaypoints(updatedWaypoints);
  };

  // Generate spline points for smooth path
  const generateSplinePoints = () => {
    if (waypoints.length < 2) return [];
    
    const points = [];
    const tension = 0.5;
    const numSegments = 20;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p0 = i > 0 ? waypoints[i-1] : waypoints[i];
      const p1 = waypoints[i];
      const p2 = waypoints[i+1];
      const p3 = i < waypoints.length - 2 ? waypoints[i+2] : waypoints[i+1];
      
      for (let t = 0; t <= numSegments; t++) {
        const t1 = t / numSegments;
        
        // Catmull-Rom spline formula
        const t2 = t1 * t1;
        const t3 = t2 * t1;
        
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t1 +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t1 +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        
        points.push(x, y);
      }
    }
    
    return points;
  };

  // Start simulation
  const startSimulation = () => {
    if (waypoints.length < 2) return;
    
    setSimulation({
      ...simulation,
      isRunning: true,
      currentPosition: { ...waypoints[0] },
      progress: 0
    });
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animate();
  };

  // Stop simulation
  const stopSimulation = () => {
    setSimulation({
      ...simulation,
      isRunning: false
    });
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // Reset simulation
  const resetSimulation = () => {
    stopSimulation();
    setSimulation({
      ...simulation,
      currentPosition: null,
      progress: 0
    });
  };

  // Animation loop
  const animate = () => {
    setSimulation(prev => {
      if (!prev.isRunning) return prev;
      
      let newProgress = prev.progress + (0.5 * prev.speed);
      if (newProgress >= waypoints.length - 1) {
        newProgress = waypoints.length - 1;
        return {
          ...prev,
          isRunning: false,
          progress: newProgress,
          currentPosition: { ...waypoints[waypoints.length - 1] }
        };
      }
      
      const currentIndex = Math.floor(newProgress);
      const nextIndex = Math.min(currentIndex + 1, waypoints.length - 1);
      const fraction = newProgress - currentIndex;
      
      const currentPos = waypoints[currentIndex];
      const nextPos = waypoints[nextIndex];
      
      const newPosition = {
        x: currentPos.x + (nextPos.x - currentPos.x) * fraction,
        y: currentPos.y + (nextPos.y - currentPos.y) * fraction,
        angle: calculateAngle(currentPos, nextPos)
      };
      
      return {
        ...prev,
        progress: newProgress,
        currentPosition: newPosition
      };
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // Save path data
  const savePath = () => {
    const pathData = {
      waypoints: waypoints.map(wp => ({
        realX: wp.realX,
        realY: wp.realY,
        angle: wp.angle,
        speed: wp.speed
      })),
      settings
    };
    
    const blob = new Blob([JSON.stringify(pathData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fll_path.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load path data
  const loadPath = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.waypoints && Array.isArray(data.waypoints)) {
          const loadedWaypoints = data.waypoints.map(wp => {
            const pixelCoords = realToPixelCoordinates(wp.realX, wp.realY);
            return {
              ...wp,
              x: pixelCoords.x,
              y: pixelCoords.y
            };
          });
          setWaypoints(loadedWaypoints);
          
          if (data.settings) {
            setSettings({...settings, ...data.settings});
          }
        }
      } catch (error) {
        console.error("Error loading path data:", error);
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  // Export path for code
  const exportPathCode = () => {
    const pathCode = `
from hub import motion_sensor, port, button
import runloop, motor_pair, time, color_sensor, color
from motor import *
import math
from math import atan2, degrees, sqrt

# Waypoints em coordenadas do campo (x, y, ângulo)
waypoints = [
${waypoints.map(wp => `    (${wp.realX}, ${wp.realY}, ${wp.angle.toFixed(1)}),`).join('\n')}
]

# Definição da classe Controle_PID
class Controle_PID:
    def __init__(self, kp, ki, kd):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.integral_sum = 0
        self.last_error = 0
    
    async def calculate(self, target, power):
        error = target - motion_sensor.tilt_angles()[0]
        self.integral_sum += error
        derivative = error - self.last_error
        self.last_error = error
        correction = (self.kp * error) + (self.ki * self.integral_sum) + (self.kd * derivative)
        return power - correction, power + correction

# Classe PathPlanner
class PathPlanner:
    def __init__(self, largura, altura):
        self.largura = largura
        self.altura = altura
        self.missoes = []
        self.x_atual = 0# Posição inicial no eixo X -
        self.y_atual = 0# Posição inicial no eixo Y

    def adicionar_missao(self, missao):
        self.missoes.append(missao)

    def calcular_rota(self, coordenada_atual, missao_proxima):
        delta_x = missao_proxima.coordenadas[0] - coordenada_atual[0]
        delta_y = missao_proxima.coordenadas[1] - coordenada_atual[1]
        distancia = math.sqrt(delta_x**2 + delta_y**2)
        angulo = math.degrees(math.atan2(delta_y, delta_x))
        return round(distancia, 2), round(angulo, 2)

    def converter_distancia_para_graus(self, distancia_cm):
        return int((distancia_cm / 5) * 103)

    def calcular_distancia(self, x_atual, y_atual, x_destino, y_destino):
        return sqrt((x_destino - x_atual) ** 2 + (y_destino - y_atual) ** 2)

    def calcular_angulo(self, x_atual, y_atual, x_destino, y_destino):
        angulo_rad = atan2(y_destino - y_atual, x_destino - x_atual)
        return degrees(angulo_rad)

    async def mover_para_ponto(self, x_m, y_m):
        # Atualiza a posição atual do robô
        x_inicial, y_inicial = self.x_atual, self.y_atual

        # Calcula a distância e o ângulo até o ponto de destino
        distancia_cm = self.calcular_distancia(x_inicial, y_inicial, x_m, y_m) # Cada unidade = 2 cm
        angulo_graus = int(self.calcular_angulo(x_inicial, y_inicial, x_m, y_m))

        if angulo_graus == 0:# Evitar divisão por zero
            motor_pair.move_for_degrees(motor_pair.PAIR_1, self.converter_distancia_para_graus(distancia_cm), 0, velocity=700)
        else:
            # Gira o robô para alinhar com o ângulo desejado
            motion_sensor.reset_yaw(0)
            print("Angulo em Graus {}".format(angulo_graus))

            if angulo_graus > 0:
                while round((motion_sensor.tilt_angles()[0] / 10)) != ((angulo_graus * -1) ):
                    motor_pair.move_tank(motor_pair.PAIR_1, int((300 * angulo_graus) / angulo_graus), int((-300 * angulo_graus) / angulo_graus))

                print("Giro Realizado com Sucesso!")
                motor_pair.stop(motor_pair.PAIR_1)

            else:
                while round((motion_sensor.tilt_angles()[0] / 10)) != ((angulo_graus * -1)):
                    motor_pair.move_tank(motor_pair.PAIR_1, int((-300 * angulo_graus) / angulo_graus), int((300 * angulo_graus) / angulo_graus))

                print("Giro Realizado com Sucesso!")
                motor_pair.stop(motor_pair.PAIR_1)

        # Move o robô para frente pela distância calculada
        await motor_pair.move_for_degrees(motor_pair.PAIR_1, self.converter_distancia_para_graus(distancia_cm), 0, velocity=spike.velocidade)

        self.x_atual = x_inicial + distancia_cm * math.cos(math.radians(angulo_graus))# Atualiza posição X

        self.y_atual = y_inicial + distancia_cm * math.sin(math.radians(angulo_graus))# Atualiza posição Y
        print("Posição atual: X = {}, Y = {}".format(self.x_atual, self.y_atual))

# Criando instância do robô
pid = Controle_PID(0.65, 0.01, 0.4)
spike = PathPlanner(220, 140)

async def main():
    for x, y, angle in waypoints:
        await spike.mover_para_ponto(x, y)

runloop.run(main())
`;
    
    const blob = new Blob([pathCode], { type: 'text/python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fll_path.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render the grid
  const renderGrid = () => {
    if (!settings.showGrid) return null;
    
    const gridLines = [];
    const { width, height, gridSize } = { ...fieldDimensions, gridSize: settings.gridSize };
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      gridLines.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, height]}
          stroke="#aaa"  // Lighter color for better visibility
          strokeWidth={0.5}
          opacity={0.4}  // Increased opacity
        />
      );
    }
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      gridLines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, width, y]}
          stroke="#aaa"  // Lighter color for better visibility
          strokeWidth={0.5}
          opacity={0.4}  // Increased opacity
        />
      );
    }
    
    return gridLines;
  };

  // Render coordinate labels
  const renderCoordinates = () => {
    if (!settings.showCoordinates) return null;
    
    const labels = [];
    const { width, height, realWidth, realHeight } = fieldDimensions;
    const numLabels = 8; // Number of labels on each axis
    
    // X-axis labels
    for (let i = 0; i <= numLabels; i++) {
      const x = (width / numLabels) * i;
      const realX = (realWidth / numLabels) * i;
      labels.push(
        <Text
          key={`x-${i}`}
          x={x}
          y={height - 20}
          text={realX.toFixed(1)}
          fontSize={14}  // Increased font size
          fontFamily="Arial"  // Specified font
          fill="#000000"  // Black text for visibility
          align="center"
          stroke="#ffffff"  // White outline for better contrast
          strokeWidth={1}
        />
      );
    }
    
    // Y-axis labels
    for (let i = 0; i <= numLabels; i++) {
      const y = (height / numLabels) * i;
      const realY = realHeight - (realHeight / numLabels) * i;
      labels.push(
        <Text
          key={`y-${i}`}
          x={10}
          y={y}
          text={realY.toFixed(1)}
          fontSize={14}  // Increased font size
          fontFamily="Arial"  // Specified font
          fill="#000000"  // Black text for visibility
          align="right"
          stroke="#ffffff"  // White outline for better contrast
          strokeWidth={1}
        />
      );
    }
    
    return labels;
  };

  // Render direction arrows
  const renderDirectionArrows = () => {
    if (!settings.showDirectionArrows || waypoints.length < 2) return null;
    
    return waypoints.map((waypoint, index) => {
      if (index === waypoints.length - 1) return null;
      
      const nextWaypoint = waypoints[index + 1];
      const dx = nextWaypoint.x - waypoint.x;
      const dy = nextWaypoint.y - waypoint.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const midX = waypoint.x + dx * 0.5;
      const midY = waypoint.y + dy * 0.5;
      const angle = Math.atan2(dy, dx);
      
      // Only draw arrows for segments that are long enough
      if (length < 50) return null;
      
      return (
        <Group key={`arrow-${index}`} x={midX} y={midY} rotation={angle * 180 / Math.PI}>
          <Line
            points={[-10, -5, 0, 0, -10, 5]}
            stroke="#FFD700"
            strokeWidth={3}  // Thicker arrows
            closed={false}
          />
        </Group>
      );
    });
  };

  return (
    <Box sx={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      bgcolor: "#2a3440",  // Lighter background for better contrast
      color: "#f0f0f0",  // Light text for readability
      overflow: "hidden",
      fontFamily: "Roboto, Arial, sans-serif"  // Consistent font family
    }}>
      {/* Header */}
      <Box sx={{
        p: 2,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #4a5568",
        bgcolor: "#1a2633"  // Darker header for contrast
      }}>
        <Typography variant="h4" sx={{ fontWeight: "bold", color: "#4fc3f7", letterSpacing: "0.2px", fontFamily: "Rubik, sans-serif" }}>
          FLL Path Planner - Team Dragon #79091
        </Typography>
        
        <Box sx={{ display: "flex", gap: 2 }}>
          <Tooltip title="Save Path">
            <IconButton color="primary" onClick={savePath} sx={{ bgcolor: "rgba(255,255,255,0.05)" }}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Load Path">
            <IconButton color="primary" component="label" sx={{ bgcolor: "rgba(255,255,255,0.05)" }}>
              <FileUploadIcon />
              <input type="file" accept=".json" hidden onChange={loadPath} />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={settings.showGrid ? "Hide Grid" : "Show Grid"}>
            <IconButton
              color={settings.showGrid ? "primary" : "default"}
              onClick={() => setSettings({...settings, showGrid: !settings.showGrid})}
              sx={{ bgcolor: "rgba(255,255,255,0.05)" }}
            >
              {settings.showGrid ? <GridOnIcon /> : <GridOffIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Main stage */}
        <Box sx={{ flex: 1, position: "relative", bgcolor: "#f5f5f5" }}>
          <Stage
            width={fieldDimensions.width}
            height={fieldDimensions.height}
            onClick={addWaypoint}
            ref={stageRef}
          >
            <Layer>
              {/* Background image */}
              {image && (
                <Image
                  image={image}
                  width={fieldDimensions.width}
                  height={fieldDimensions.height}
                />
              )}
              
              {/* Grid */}
              {renderGrid()}
              
              {/* Coordinate labels */}
              {renderCoordinates()}
              
              {/* Path */}
              {waypoints.length > 1 && (
                <Line
                  points={settings.pathType === "spline" ? 
                    generateSplinePoints() : 
                    waypoints.flatMap(p => [p.x, p.y])}
                  stroke="#4fc3f7"
                  strokeWidth={settings.pathThickness + 1}  // Slightly thicker path
                  tension={settings.pathType === "spline" ? 0.5 : 0}
                  shadowColor="rgba(0,0,0,0.3)"  // Add shadow for depth
                  shadowBlur={3}
                  shadowOffset={{ x: 1, y: 1 }}
                />
              )}
              
              {/* Direction arrows */}
              {renderDirectionArrows()}
              
              {/* Waypoints */}
              {waypoints.map((point, i) => (
                <Group key={i}>
                  <Circle
                    x={point.x}
                    y={point.y}
                    radius={settings.waypointRadius + 1}  // Slightly larger waypoints
                    fill={i === 0 ? "#4CAF50" : i === waypoints.length - 1 ? "#F44336" : "#FFD700"}
                    stroke="#fff"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleWaypointDrag(i, e)}
                    onDragEnd={(e) => handleWaypointDrag(i, e)}
                    onClick={() => setSelectedWaypointIndex(i)}
                    shadowColor="rgba(0,0,0,0.5)"  // Add shadow for depth
                    shadowBlur={4}
                    shadowOffset={{ x: 1, y: 1 }}
                  />
                  {settings.showCoordinates && (
                    <Text
                      x={point.x + 10}
                      y={point.y - 20}
                      text={`(${point.realX.toFixed(2)}, ${point.realY.toFixed(2)})`}
                      fontSize={12}
                      fontFamily="Arial"
                      fill="#000000"  // Black text for coordinates
                      stroke="#ffffff"  // White outline for contrast
                      strokeWidth={0.5}
                      shadowColor="rgba(255,255,255,0.5)"
                      shadowBlur={4}
                    />
                  )}
                </Group>
              ))}
              
              {/* Robot simulation */}
              {simulation.currentPosition && (
                <Group
                  x={simulation.currentPosition.x}
                  y={simulation.currentPosition.y}
                  rotation={simulation.currentPosition.angle}
                >
                  <Rect
                    width={30}
                    height={30}
                    offsetX={15}
                    offsetY={15}
                    fill="#4CAF50"
                    stroke="#fff"
                    strokeWidth={2}
                    cornerRadius={3}  // Rounded corners
                    shadowColor="rgba(0,0,0,0.5)"  // Add shadow for depth
                    shadowBlur={5}
                    shadowOffset={{ x: 2, y: 2 }}
                  />
                  <Line
                    points={[0, 0, 20, 0]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                </Group>
              )}
            </Layer>
          </Stage>
        </Box>
        
        {/* Side panel */}
        <Paper sx={{
          width: 320,
          p: 2,
          display: "flex",
          flexDirection: "column",
          bgcolor: "#2c3e50",  // Darker but visible sidebar
          borderLeft: "1px solid #34495e",
          overflowY: "auto",
          color: "#ecf0f1"  // Light text for readability
        }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#4fc3f7" }}>
            Path Controls
          </Typography>
          
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={startSimulation}
              disabled={waypoints.length < 2 || simulation.isRunning}
              fullWidth
              sx={{ fontWeight: "bold", py: 1 }}
            >
              Start
            </Button>
            
            <Button
              variant="contained"
              color="warning"
              startIcon={<PauseIcon />}
              onClick={stopSimulation}
              disabled={!simulation.isRunning}
              fullWidth
              sx={{ fontWeight: "bold", py: 1 }}
            >
              Pause
            </Button>
            
            <Button
              variant="contained"
              color="error"
              startIcon={<RestartAltIcon />}
              onClick={resetSimulation}
              disabled={waypoints.length < 1}
              fullWidth
              sx={{ fontWeight: "bold", py: 1 }}
            >
              Reset
            </Button>
          </Box>
          
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold", color: "#81e6d9" }}>
            Simulation Speed
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <IconButton
              size="small"
              onClick={() => setSimulation({...simulation, speed: Math.max(0.1, simulation.speed - 0.1)})}
            >
              <RemoveIcon />
            </IconButton>
            
            <Slider
              value={simulation.speed}
              min={0.1}
              max={1}
              step={0.1}
              onChange={(_, value) => setSimulation({...simulation, speed: value})}
              sx={{ mx: 2 }}
            />
            
            <IconButton
              size="small"
              onClick={() => setSimulation({...simulation, speed: Math.min(1, simulation.speed + 0.1)})}
            >
              <AddIcon />
            </IconButton>
            
            <Typography sx={{ ml: 1, minWidth: 40 }}>
              {simulation.speed.toFixed(1)}x
            </Typography>
          </Box>
          
          <Tooltip title="Apply these settings to create smoother paths">
            <Typography variant="subtitle1" gutterBottom>
              Path Settings
            </Typography>
          </Tooltip>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.snapToGrid}
                onChange={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}
              />
            }
            label="Snap to Grid"
            sx={{ mb: 1 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.pathType === "spline"}
                onChange={() => setSettings({
                  ...settings, 
                  pathType: settings.pathType === "spline" ? "line" : "spline"
                })}
              />
            }
            label="Smooth Path"
            sx={{ mb: 1 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.showDirectionArrows}
                onChange={() => setSettings({
                  ...settings, 
                  showDirectionArrows: !settings.showDirectionArrows
                })}
              />
            }
            label="Show Direction Arrows"
            sx={{ mb: 2 }}
          />
          
          <Typography variant="subtitle1" gutterBottom>
            Waypoints ({waypoints.length})
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            {waypoints.map((point, i) => (
              <Paper
                key={i}
                sx={{
                  p: 1,
                  mb: 1,
                  bgcolor: selectedWaypointIndex === i ? "#2c3e50" : "#333",
                  borderLeft: `4px solid ${
                    i === 0 ? "#4CAF50" : 
                    i === waypoints.length - 1 ? "#F44336" : 
                    "#FFD700"
                  }`
                }}
                onClick={() => setSelectedWaypointIndex(i)}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography>
                    {i === 0 ? "Start" : i === waypoints.length - 1 ? "End" : `Waypoint ${i}`}
                  </Typography>
                  
                  <Typography variant="caption">
                    ({point.realX.toFixed(2)}, {point.realY.toFixed(2)})
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
          
          <Box sx={{ display: "flex", gap: 1, mt: "auto" }}>
            <Button
              variant="outlined"
              startIcon={<UndoIcon />}
              onClick={undoLastWaypoint}
              disabled={waypoints.length === 0}
              fullWidth
            >
              Undo Last
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={clearAllWaypoints}
              disabled={waypoints.length === 0}
              fullWidth
            >
              Clear All
            </Button>
          </Box>
          
          <Button
            variant="contained"
            color="info"
            onClick={exportPathCode}
            disabled={waypoints.length < 2}
            sx={{ mt: 2 }}
            fullWidth
          >
            Export Python Code
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}