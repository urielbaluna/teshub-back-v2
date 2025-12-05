-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-12-2025 a las 18:22:05
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `teshub`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `archivos`
--

CREATE TABLE `archivos` (
  `ruta` varchar(100) DEFAULT NULL,
  `id_publi` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `comentario`
--

CREATE TABLE `comentario` (
  `comentario` varchar(300) DEFAULT NULL,
  `matricula` int(11) DEFAULT NULL,
  `id_publi` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evaluacion`
--

CREATE TABLE `evaluacion` (
  `matricula` int(11) NOT NULL,
  `id_publi` int(11) NOT NULL,
  `evaluacion` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento`
--

CREATE TABLE `evento` (
  `id_evento` int(11) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `fecha` datetime DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `cupo_maximo` int(11) NOT NULL DEFAULT 50,
  `url_foto` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento_asistentes`
--

CREATE TABLE `evento_asistentes` (
  `id_evento` int(11) NOT NULL,
  `matricula` int(11) NOT NULL,
  `fecha_registro` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento_organizadores`
--

CREATE TABLE `evento_organizadores` (
  `id_evento` int(11) NOT NULL,
  `matricula` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `integrantes`
--

CREATE TABLE `integrantes` (
  `matricula` varchar(255) NOT NULL,
  `id_publi` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `publicacion`
--

CREATE TABLE `publicacion` (
  `id_publi` int(11) NOT NULL,
  `nombre` varchar(250) DEFAULT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  `fecha` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `matricula` int(11) NOT NULL,
  `nombre` varchar(25) DEFAULT NULL,
  `apellido` varchar(25) DEFAULT NULL,
  `contrasena` varchar(75) DEFAULT NULL,
  `correo` varchar(320) DEFAULT NULL,
  `rol` int(11) DEFAULT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD KEY `archivos_ibfk_1` (`id_publi`);

--
-- Indices de la tabla `comentario`
--
ALTER TABLE `comentario`
  ADD KEY `matricula` (`matricula`),
  ADD KEY `comentario_ibfk_2` (`id_publi`);

--
-- Indices de la tabla `evaluacion`
--
ALTER TABLE `evaluacion`
  ADD PRIMARY KEY (`matricula`,`id_publi`);

--
-- Indices de la tabla `evento`
--
ALTER TABLE `evento`
  ADD PRIMARY KEY (`id_evento`);

--
-- Indices de la tabla `evento_asistentes`
--
ALTER TABLE `evento_asistentes`
  ADD PRIMARY KEY (`id_evento`,`matricula`),
  ADD KEY `idx_evento` (`id_evento`),
  ADD KEY `idx_matricula` (`matricula`);

--
-- Indices de la tabla `evento_organizadores`
--
ALTER TABLE `evento_organizadores`
  ADD PRIMARY KEY (`id_evento`,`matricula`),
  ADD KEY `matricula` (`matricula`);

--
-- Indices de la tabla `integrantes`
--
ALTER TABLE `integrantes`
  ADD PRIMARY KEY (`matricula`,`id_publi`);

--
-- Indices de la tabla `publicacion`
--
ALTER TABLE `publicacion`
  ADD PRIMARY KEY (`id_publi`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`matricula`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `publicacion`
--
ALTER TABLE `publicacion`
  MODIFY `id_publi` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD CONSTRAINT `archivos_ibfk_1` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`);

--
-- Filtros para la tabla `comentario`
--
ALTER TABLE `comentario`
  ADD CONSTRAINT `comentario_ibfk_1` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `comentario_ibfk_2` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`);

--
-- Filtros para la tabla `evento_asistentes`
--
ALTER TABLE `evento_asistentes`
  ADD CONSTRAINT `evento_asistentes_ibfk_1` FOREIGN KEY (`id_evento`) REFERENCES `evento` (`id_evento`) ON DELETE CASCADE,
  ADD CONSTRAINT `evento_asistentes_ibfk_2` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;

--
-- Filtros para la tabla `evento_organizadores`
--
ALTER TABLE `evento_organizadores`
  ADD CONSTRAINT `evento_organizadores_ibfk_1` FOREIGN KEY (`id_evento`) REFERENCES `evento` (`id_evento`) ON DELETE CASCADE,
  ADD CONSTRAINT `evento_organizadores_ibfk_2` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
