# Entrega de versiones de DashCom Desktop

Esta es la politica de entrega solicitada por el usuario: cada actualizacion funcional, visual o correctiva de la aplicacion debe incluir un nuevo instalador del mismo tipo que las versiones anteriores. Un cambio exclusivamente documental no requiere nuevo ejecutable, salvo solicitud expresa.

## Formato e identidad

- Plataforma: Windows x64; aplicacion Electron con instalador NSIS asistido.
- Archivo: `DashCom-Setup-<version>-x64.exe`.
- Configuracion oficial: `electron-builder.yml`.
- Mantener `appId: com.dashcom.desktop`, `productName: DashCom`, `oneClick: false`, accesos directos y `deleteAppDataOnUninstall: false`.
- Conservar el icono y la identidad visual vigentes. No sustituir el instalador por un ZIP, una version portable o solo `win-unpacked`.
- La entrega actual queda en `C:\Users\chval\OneDrive\Escritorio\Dashcom Desktop`. El script resuelve por defecto la carpeta `Dashcom Desktop` del escritorio del usuario de Windows.

## Conservacion de datos

La actualizacion reemplaza los archivos de la aplicacion y reutiliza los datos del mismo usuario de Windows en `%LOCALAPPDATA%\DashCom`:

- Base: `data\hyl_gym.db`.
- Archivos cargados: `uploads`.
- Configuracion: `config.env`.
- Respaldos: `backups\hyl_gym-before-<version>.db`.

Mantener en `desktop/main.cjs` la copia inicial de la base solo cuando no existe y la conservacion de la configuracion existente. Mantener el envio de `DASHCOM_DESKTOP_VERSION` al servidor y el respaldo SQLite previo a migraciones en `src/server/index.ts`; si el respaldo falla, no continuar con la migracion. No ejecutar `db:reset` sobre datos instalados ni sustituirlos por la base incluida en el instalador.

## Procedimiento de entrega

1. Revisar la version vigente en `package.json` y los instaladores existentes; asignar una version superior para cada nueva entrega de la aplicacion y sincronizarla en `package-lock.json`. No asumir que la ultima version mencionada en una conversacion sigue siendo la actual.
2. Completar los cambios y las verificaciones pertinentes. Para cambios visuales, revisar escritorio y pantallas pequenas, textos completos, alineacion, controles y desbordamientos.
3. Revisar la fuente de los datos iniciales antes de preparar el paquete. El script utiliza el contenedor `dashcom` cuando lo encuentra o la base local `data/hyl_gym.db`; no asume como fuente la base de la instalacion Desktop. Una base SQLite en uso requiere una copia consistente, por ejemplo mediante la API de backup de SQLite. Mantener los datos reales separados de las pruebas.
4. Desde la raiz del proyecto, ejecutar el flujo de entrega:

   ```powershell
   $env:NODE_OPTIONS = '--use-system-ca'
   npm run desktop:installer
   ```

   Este comando prepara `desktop-build`, ejecuta pruebas, compila cliente y servidor, reconstruye `better-sqlite3` para Electron, genera el NSIS y copia el instalador al escritorio. La configuracion incluida puede contener credenciales: no imprimirla ni publicarla en el repositorio.

   Si `desktop-build` ya esta preparado y validado, se puede ejecutar `npm run desktop:build`; en ese caso hay que completar manualmente la copia y las verificaciones de entrega. `npm run desktop:dir` sirve para pruebas, no produce la entrega final.

5. Confirmar que `release\DashCom-Setup-<version>-x64.exe` corresponde exactamente a la version solicitada y contiene los cambios finales. No seleccionar un instalador anterior solo por su fecha. Si se corrige algo despues del QA, reconstruir antes de entregar.
6. Verificar el arranque del paquete con datos aislados cuando los cambios lo requieran y la continuidad de datos cuando se modifiquen migraciones, rutas o empaquetado. Cerrar los procesos de prueba al terminar.
7. Copiar el ejecutable a `Dashcom Desktop`, conservar los instaladores de versiones anteriores y comparar SHA-256 del origen y destino con `Get-FileHash -Algorithm SHA256`.
8. Actualizar `LEEME.txt` con la version, fecha, novedades reales, ubicacion de datos y respaldo. Revisar tambien las notas que genera `scripts/build-desktop-installer.ps1`, para no arrastrar una novedad fija de una version anterior.
9. Entregar al usuario el enlace absoluto al nuevo `.exe`, un resumen de cambios y las verificaciones realizadas. Generar el instalador no implica ejecutarlo sobre la instalacion del usuario.

## Criterio de finalizacion

Una actualizacion de la aplicacion solo esta lista cuando el nuevo instalador existe, corresponde al codigo validado y esta en la carpeta de entrega. Si una prueba o el empaquetado falla, resolverlo o comunicar el bloqueo concreto; no afirmar que un instalador anterior contiene la nueva actualizacion.
