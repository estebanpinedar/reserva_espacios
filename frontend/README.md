# Frontend de Reserva Campus

Interfaz estática en HTML, CSS y JavaScript que consume la API REST de `rsu_auth-service`.

## Ejecución local

1. Inicia el backend siguiendo su README. La interfaz espera la API en `http://localhost:8080`.
2. Desde esta carpeta, inicia un servidor estático:

   ```bash
   python3 -m http.server 5500
   ```

3. Abre `http://localhost:5500` en el navegador.

No abras los HTML como archivos `file://`: el navegador necesita un origen HTTP para enviar las
solicitudes a la API.

## Funciones conectadas

- Registro e inicio de sesión con JWT.
- Consulta y filtrado del catálogo por texto, tipo y capacidad mínima.
- Creación de reservas, consulta de las propias reservas y cancelación.
- Cierre de sesión y eliminación del token local.

El token se guarda en `localStorage` bajo la clave `reservationAccessToken`. La URL de API se puede
cambiar desde la consola del navegador con `localStorage.setItem("reservationApiBaseUrl", "https://servidor-api")`.

El backend permite por defecto los orígenes locales `localhost` y `127.0.0.1` en los puertos 5500 y
8000. Para otro origen, configura `APP_WEB_ALLOWED_ORIGINS` con una lista separada por comas antes
de iniciar el backend.
