# Entrega de actualizaciones DashCom

Por instruccion del usuario, toda actualizacion de la aplicacion debe terminar con un nuevo instalador Windows x64 del mismo tipo que las versiones anteriores. Seguir [docs/DESKTOP_RELEASE.md](docs/DESKTOP_RELEASE.md).

- Entregar `DashCom-Setup-<version>-x64.exe`, generado con Electron Builder y NSIS, en la carpeta del escritorio `Dashcom Desktop`.
- Incrementar la version, validar los cambios, hacer QA visual cuando corresponda y verificar el paquete final antes de entregarlo.
- Conservar la identidad de la aplicacion y los datos de `%LOCALAPPDATA%\DashCom`, incluido el respaldo previo a migraciones.
- Una compilacion web, una carpeta `win-unpacked` o un archivo ZIP no completan una entrega de actualizacion de la aplicacion.
- Los cambios exclusivamente documentales no requieren recompilar el instalador, salvo solicitud del usuario. Si el empaquetado falla, informar el bloqueo sin presentar un instalador anterior como actualizado.
