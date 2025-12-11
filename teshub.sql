-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 11-12-2025 a las 06:16:54
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `teshub2`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `archivos`
--

CREATE TABLE `archivos` (
  `ruta` varchar(100) DEFAULT NULL,
  `id_publi` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `archivos`
--

INSERT INTO `archivos` (`ruta`, `id_publi`) VALUES
('uploads/publicaciones/1765257974063-948629361-archivos.jpeg', 10),
('uploads/publicaciones/1765306256548-17776322-archivos.jpeg', 9),
('uploads/publicaciones/1765401543278-963639790-archivos.pdf', 11);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `asesorias`
--

CREATE TABLE `asesorias` (
  `id_asesoria` int(11) NOT NULL,
  `matricula_asesor` int(11) NOT NULL,
  `matricula_estudiante` int(11) NOT NULL,
  `estado` tinyint(1) DEFAULT 0 COMMENT '0: Pendiente, 1: Activa, 2: Rechazada',
  `fecha_solicitud` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `asesorias`
--

INSERT INTO `asesorias` (`id_asesoria`, `matricula_asesor`, `matricula_estudiante`, `estado`, `fecha_solicitud`) VALUES
(1, 1234, 202124003, 1, '2025-12-06 02:03:59'),
(2, 1234, 202124300, 1, '2025-12-09 12:52:25');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `codigos_acceso`
--

CREATE TABLE `codigos_acceso` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `rol_destino` int(11) DEFAULT 2 COMMENT '2: Asesor',
  `esta_usado` tinyint(1) DEFAULT 0 COMMENT '0: No, 1: Si',
  `usado_por_matricula` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `codigos_acceso`
--

INSERT INTO `codigos_acceso` (`id`, `codigo`, `rol_destino`, `esta_usado`, `usado_por_matricula`, `fecha_creacion`) VALUES
(1, 'PROFE_2025', 2, 1, 1234, '2025-12-06 04:43:47'),
(2, 'CIENCIAS_TESHUB', 2, 0, NULL, '2025-12-06 04:43:47'),
(3, 'DOCENTE_INVITADO', 2, 0, NULL, '2025-12-06 04:43:47');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `codigos_verificacion`
--

CREATE TABLE `codigos_verificacion` (
  `id` int(11) NOT NULL,
  `correo` varchar(320) NOT NULL,
  `codigo` varchar(6) NOT NULL,
  `fecha_expiracion` datetime NOT NULL,
  `usado` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `codigos_verificacion`
--

INSERT INTO `codigos_verificacion` (`id`, `correo`, `codigo`, `fecha_expiracion`, `usado`) VALUES
(1, 'barreralunauriel@gmail.com', '621334', '2025-12-09 12:56:33', 1),
(2, 'barreralunauriel@gmail.com', '295571', '2025-12-10 23:41:37', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `comentario`
--

CREATE TABLE `comentario` (
  `comentario` varchar(300) DEFAULT NULL,
  `matricula` int(11) DEFAULT NULL,
  `id_publi` int(11) DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `comentario`
--

INSERT INTO `comentario` (`comentario`, `matricula`, `id_publi`, `fecha`) VALUES
('holA', 202124003, 8, '2025-12-09 00:21:19'),
('Holaaaaaaaaaaaaaa2', 202124003, 8, '2025-12-09 00:22:10'),
('Comentario', 202124003, 9, '2025-12-09 12:50:42');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conexiones`
--

CREATE TABLE `conexiones` (
  `seguidor_matricula` int(11) NOT NULL,
  `seguido_matricula` int(11) NOT NULL,
  `fecha_conexion` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `conexiones`
--

INSERT INTO `conexiones` (`seguidor_matricula`, `seguido_matricula`, `fecha_conexion`) VALUES
(1234, 202124003, '2025-12-09 01:31:52'),
(202124003, 1234, '2025-12-10 15:13:10'),
(202124003, 202124300, '2025-12-09 12:50:16');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `etiquetas`
--

CREATE TABLE `etiquetas` (
  `id_etiqueta` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `etiquetas`
--

INSERT INTO `etiquetas` (`id_etiqueta`, `nombre`) VALUES
(2, 'AI'),
(3, 'CHAT'),
(1, 'IA'),
(4, 'React');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evaluacion`
--

CREATE TABLE `evaluacion` (
  `matricula` int(11) NOT NULL,
  `id_publi` int(11) NOT NULL,
  `evaluacion` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `evaluacion`
--

INSERT INTO `evaluacion` (`matricula`, `id_publi`, `evaluacion`) VALUES
(202124003, 8, 5);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento`
--

CREATE TABLE `evento` (
  `id_evento` int(11) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `categoria` varchar(50) DEFAULT 'General',
  `fecha` datetime DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `cupo_maximo` int(11) NOT NULL DEFAULT 50,
  `url_foto` varchar(255) DEFAULT NULL,
  `ubicacion_nombre` varchar(255) DEFAULT NULL COMMENT 'Ej: Auditorio Principal',
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `evento`
--

INSERT INTO `evento` (`id_evento`, `titulo`, `categoria`, `fecha`, `descripcion`, `cupo_maximo`, `url_foto`, `ubicacion_nombre`, `latitud`, `longitud`, `fecha_creacion`) VALUES
(3, 'event', 'Cultural', '2025-12-07 01:58:00', 'Descripcion', 10, 'uploads/eventos/1765007980510-evento_cover_1765007979529.jpg', 'TESCHA', 19.23514847, -98.84057935, '2025-12-06 07:59:40'),
(4, 'event', 'Otro', '2025-12-06 08:22:00', 'desssssssc', 2, 'uploads/eventos/1765009439745-evento_cover_1765009438716.jpg', 'Ay', 19.23504970, -98.84167906, '2025-12-06 08:23:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento_asistentes`
--

CREATE TABLE `evento_asistentes` (
  `id_evento` int(11) NOT NULL,
  `matricula` int(11) NOT NULL,
  `fecha_registro` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `evento_asistentes`
--

INSERT INTO `evento_asistentes` (`id_evento`, `matricula`, `fecha_registro`) VALUES
(3, 1234, '2025-12-10 15:10:15'),
(4, 1234, '2025-12-09 12:51:46');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento_etiquetas`
--

CREATE TABLE `evento_etiquetas` (
  `id_evento` int(11) NOT NULL,
  `id_etiqueta` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `evento_etiquetas`
--

INSERT INTO `evento_etiquetas` (`id_evento`, `id_etiqueta`) VALUES
(3, 1),
(4, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `evento_organizadores`
--

CREATE TABLE `evento_organizadores` (
  `id_evento` int(11) NOT NULL,
  `matricula` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `evento_organizadores`
--

INSERT INTO `evento_organizadores` (`id_evento`, `matricula`) VALUES
(3, 202124003),
(4, 202124003);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `integrantes`
--

CREATE TABLE `integrantes` (
  `matricula` varchar(255) NOT NULL,
  `id_publi` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `integrantes`
--

INSERT INTO `integrantes` (`matricula`, `id_publi`) VALUES
('1234', 8),
('1234', 9),
('202124003', 9),
('202124003', 10),
('202124003', 11),
('202124300', 11);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `intereses`
--

CREATE TABLE `intereses` (
  `id_interes` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `intereses`
--

INSERT INTO `intereses` (`id_interes`, `nombre`) VALUES
(3, 'Desarrollo Android'),
(2, 'Desarrollo web'),
(1, 'IA');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `publicacion`
--

CREATE TABLE `publicacion` (
  `id_publi` int(11) NOT NULL,
  `nombre` varchar(250) DEFAULT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  `imagen_portada` varchar(255) DEFAULT NULL COMMENT 'Ruta de la imagen thumbnail',
  `fecha` date DEFAULT NULL,
  `estado` enum('pendiente','aprobado','rechazado','correcciones') NOT NULL DEFAULT 'pendiente',
  `vistas` int(11) DEFAULT 0,
  `descargas` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `publicacion`
--

INSERT INTO `publicacion` (`id_publi`, `nombre`, `descripcion`, `imagen_portada`, `fecha`, `estado`, `vistas`, `descargas`) VALUES
(8, 'tiiituloo', 'desc', 'uploads/publicaciones/1765040847042-portada', '2025-12-06', 'aprobado', 30, 0),
(9, 'pro', 'IA', 'uploads/publicaciones/1765041072754-452328126-portada', '2025-12-06', 'aprobado', 10, 0),
(10, 'tusds', 'desc', 'uploads/publicaciones/1765044307753-231559259-portada', '2025-12-06', 'aprobado', 5, 1),
(11, 'Cahngo', 'Descripcion 1', 'uploads/publicaciones/1765401543270-212459096-portada', '2025-12-10', 'aprobado', 18, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `publicacion_etiquetas`
--

CREATE TABLE `publicacion_etiquetas` (
  `id_publi` int(11) NOT NULL,
  `id_etiqueta` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `publicacion_etiquetas`
--

INSERT INTO `publicacion_etiquetas` (`id_publi`, `id_etiqueta`) VALUES
(8, 1),
(9, 1),
(10, 3),
(11, 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `revisiones_publicacion`
--

CREATE TABLE `revisiones_publicacion` (
  `id_revision` int(11) NOT NULL,
  `id_publi` int(11) NOT NULL,
  `matricula_asesor` int(11) NOT NULL,
  `estado_asignado` enum('pendiente','aprobado','rechazado','correcciones') NOT NULL,
  `comentarios` text DEFAULT NULL,
  `fecha_revision` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `revisiones_publicacion`
--

INSERT INTO `revisiones_publicacion` (`id_revision`, `id_publi`, `matricula_asesor`, `estado_asignado`, `comentarios`, `fecha_revision`) VALUES
(2, 10, 1234, 'aprobado', 'okeeey', '2025-12-06 12:11:56'),
(3, 11, 1234, 'correcciones', 'No ta chido', '2025-12-10 15:20:46'),
(4, 11, 1234, 'correcciones', 'sigue estando mal', '2025-12-10 21:54:04'),
(5, 11, 1234, 'correcciones', 'Sigue estando mal', '2025-12-10 21:59:11'),
(6, 11, 1234, 'correcciones', 'corregir', '2025-12-10 22:07:25'),
(7, 11, 1234, 'correcciones', 'otra vez', '2025-12-10 22:13:54'),
(8, 11, 1234, 'correcciones', 'yaaa?', '2025-12-10 22:14:53'),
(9, 11, 1234, 'correcciones', 'Yaaaa?', '2025-12-10 22:15:34'),
(10, 11, 1234, 'correcciones', ':)', '2025-12-10 22:19:21'),
(11, 11, 1234, 'correcciones', ':/', '2025-12-10 22:20:52'),
(12, 11, 1234, 'correcciones', 'sigue mal', '2025-12-10 22:27:58'),
(13, 11, 1234, 'aprobado', 'muy bien', '2025-12-10 22:28:22');

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
  `carrera` varchar(100) DEFAULT NULL,
  `semestre` varchar(20) DEFAULT NULL,
  `biografia` text DEFAULT NULL,
  `ubicacion` varchar(100) DEFAULT NULL COMMENT 'Ej: Chalco, Edo Mex',
  `imagen` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`matricula`, `nombre`, `apellido`, `contrasena`, `correo`, `rol`, `carrera`, `semestre`, `biografia`, `ubicacion`, `imagen`, `estado`) VALUES
(1234, 'Horacio', 'Azamar', '$2b$10$4Bxtzs3Ov.X4CkzF8nPt3.w8TA/Iecp9Bpl9dWFjDSYMvhAkRekP.', 'urielbl48@gmail.com', 2, NULL, NULL, NULL, NULL, 'uploads/imagenes/1765008469308-temp_profile_1765008468280.jpg', 1),
(202124003, 'Uriel', 'Barrera', '$2b$10$ACa5e6veV2wu34trkDYVkekz.zRGJoRTP5Dary86z8ptPwaFOWMoS', 'barreralunauriel@gmail.com', 3, 'ISC', '9no', NULL, NULL, 'uploads/imagenes/1765008527242-temp_profile_1765008526266.jpg', 1),
(202124300, 'Uriel', 'Muerdeme la rama', '$2b$10$8X.I0UxKgTRCwe28.UmxLOxZiLXCpAdFyjoZRhrbs6oCjQA0SOP5S', 'urielbaluna@outlook.com', 3, NULL, NULL, NULL, NULL, NULL, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario_intereses`
--

CREATE TABLE `usuario_intereses` (
  `matricula` int(11) NOT NULL,
  `id_interes` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario_intereses`
--

INSERT INTO `usuario_intereses` (`matricula`, `id_interes`) VALUES
(1234, 1),
(202124003, 3),
(202124300, 3);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD KEY `archivos_ibfk_1` (`id_publi`);

--
-- Indices de la tabla `asesorias`
--
ALTER TABLE `asesorias`
  ADD PRIMARY KEY (`id_asesoria`),
  ADD UNIQUE KEY `relacion_unica` (`matricula_asesor`,`matricula_estudiante`),
  ADD KEY `fk_ase_estudiante` (`matricula_estudiante`);

--
-- Indices de la tabla `codigos_acceso`
--
ALTER TABLE `codigos_acceso`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo` (`codigo`);

--
-- Indices de la tabla `codigos_verificacion`
--
ALTER TABLE `codigos_verificacion`
  ADD PRIMARY KEY (`id`),
  ADD KEY `correo` (`correo`),
  ADD KEY `codigo` (`codigo`);

--
-- Indices de la tabla `comentario`
--
ALTER TABLE `comentario`
  ADD KEY `matricula` (`matricula`),
  ADD KEY `comentario_ibfk_2` (`id_publi`);

--
-- Indices de la tabla `conexiones`
--
ALTER TABLE `conexiones`
  ADD PRIMARY KEY (`seguidor_matricula`,`seguido_matricula`),
  ADD KEY `fk_con_seguido` (`seguido_matricula`);

--
-- Indices de la tabla `etiquetas`
--
ALTER TABLE `etiquetas`
  ADD PRIMARY KEY (`id_etiqueta`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `evaluacion`
--
ALTER TABLE `evaluacion`
  ADD PRIMARY KEY (`matricula`,`id_publi`),
  ADD KEY `fk_evaluacion_publicacion` (`id_publi`);

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
-- Indices de la tabla `evento_etiquetas`
--
ALTER TABLE `evento_etiquetas`
  ADD PRIMARY KEY (`id_evento`,`id_etiqueta`),
  ADD KEY `fk_ev_eti_etiqueta` (`id_etiqueta`);

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
  ADD PRIMARY KEY (`matricula`,`id_publi`),
  ADD KEY `fk_integrantes_publicacion` (`id_publi`);

--
-- Indices de la tabla `intereses`
--
ALTER TABLE `intereses`
  ADD PRIMARY KEY (`id_interes`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `publicacion`
--
ALTER TABLE `publicacion`
  ADD PRIMARY KEY (`id_publi`);

--
-- Indices de la tabla `publicacion_etiquetas`
--
ALTER TABLE `publicacion_etiquetas`
  ADD PRIMARY KEY (`id_publi`,`id_etiqueta`),
  ADD KEY `fk_pub_eti_tag` (`id_etiqueta`);

--
-- Indices de la tabla `revisiones_publicacion`
--
ALTER TABLE `revisiones_publicacion`
  ADD PRIMARY KEY (`id_revision`),
  ADD KEY `fk_rev_publi` (`id_publi`),
  ADD KEY `fk_rev_asesor` (`matricula_asesor`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`matricula`);

--
-- Indices de la tabla `usuario_intereses`
--
ALTER TABLE `usuario_intereses`
  ADD PRIMARY KEY (`matricula`,`id_interes`),
  ADD KEY `fk_usu_int_interes` (`id_interes`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `asesorias`
--
ALTER TABLE `asesorias`
  MODIFY `id_asesoria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `codigos_acceso`
--
ALTER TABLE `codigos_acceso`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `codigos_verificacion`
--
ALTER TABLE `codigos_verificacion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `etiquetas`
--
ALTER TABLE `etiquetas`
  MODIFY `id_etiqueta` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `evento`
--
ALTER TABLE `evento`
  MODIFY `id_evento` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `intereses`
--
ALTER TABLE `intereses`
  MODIFY `id_interes` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `publicacion`
--
ALTER TABLE `publicacion`
  MODIFY `id_publi` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT de la tabla `revisiones_publicacion`
--
ALTER TABLE `revisiones_publicacion`
  MODIFY `id_revision` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `archivos`
--
ALTER TABLE `archivos`
  ADD CONSTRAINT `archivos_ibfk_1` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE;

--
-- Filtros para la tabla `asesorias`
--
ALTER TABLE `asesorias`
  ADD CONSTRAINT `fk_ase_asesor` FOREIGN KEY (`matricula_asesor`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ase_estudiante` FOREIGN KEY (`matricula_estudiante`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;

--
-- Filtros para la tabla `comentario`
--
ALTER TABLE `comentario`
  ADD CONSTRAINT `comentario_ibfk_1` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `comentario_ibfk_2` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE;

--
-- Filtros para la tabla `conexiones`
--
ALTER TABLE `conexiones`
  ADD CONSTRAINT `fk_con_seguido` FOREIGN KEY (`seguido_matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_con_seguidor` FOREIGN KEY (`seguidor_matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;

--
-- Filtros para la tabla `evaluacion`
--
ALTER TABLE `evaluacion`
  ADD CONSTRAINT `fk_evaluacion_publicacion` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_evaluacion_usuario` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `evento_asistentes`
--
ALTER TABLE `evento_asistentes`
  ADD CONSTRAINT `evento_asistentes_ibfk_1` FOREIGN KEY (`id_evento`) REFERENCES `evento` (`id_evento`) ON DELETE CASCADE,
  ADD CONSTRAINT `evento_asistentes_ibfk_2` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;

--
-- Filtros para la tabla `evento_etiquetas`
--
ALTER TABLE `evento_etiquetas`
  ADD CONSTRAINT `fk_ev_eti_etiqueta` FOREIGN KEY (`id_etiqueta`) REFERENCES `etiquetas` (`id_etiqueta`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ev_eti_evento` FOREIGN KEY (`id_evento`) REFERENCES `evento` (`id_evento`) ON DELETE CASCADE;

--
-- Filtros para la tabla `evento_organizadores`
--
ALTER TABLE `evento_organizadores`
  ADD CONSTRAINT `evento_organizadores_ibfk_1` FOREIGN KEY (`id_evento`) REFERENCES `evento` (`id_evento`) ON DELETE CASCADE,
  ADD CONSTRAINT `evento_organizadores_ibfk_2` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;

--
-- Filtros para la tabla `integrantes`
--
ALTER TABLE `integrantes`
  ADD CONSTRAINT `fk_integrantes_publicacion` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `publicacion_etiquetas`
--
ALTER TABLE `publicacion_etiquetas`
  ADD CONSTRAINT `fk_pub_eti_id` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pub_eti_tag` FOREIGN KEY (`id_etiqueta`) REFERENCES `etiquetas` (`id_etiqueta`) ON DELETE CASCADE;

--
-- Filtros para la tabla `revisiones_publicacion`
--
ALTER TABLE `revisiones_publicacion`
  ADD CONSTRAINT `fk_rev_asesor` FOREIGN KEY (`matricula_asesor`) REFERENCES `usuario` (`matricula`),
  ADD CONSTRAINT `fk_rev_publi` FOREIGN KEY (`id_publi`) REFERENCES `publicacion` (`id_publi`) ON DELETE CASCADE;

--
-- Filtros para la tabla `usuario_intereses`
--
ALTER TABLE `usuario_intereses`
  ADD CONSTRAINT `fk_usu_int_interes` FOREIGN KEY (`id_interes`) REFERENCES `intereses` (`id_interes`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_usu_int_matricula` FOREIGN KEY (`matricula`) REFERENCES `usuario` (`matricula`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
