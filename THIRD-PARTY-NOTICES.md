# Third-Party Notices

Veritas Lab incorporates several open-source components. This document provides the required attributions and source links for these components to ensure compliance with their respective licenses.

## Summary of Major Components

| Component | License | Source |
| :--- | :--- | :--- |
| **iLEAPP** | MIT | [GitHub](https://github.com/abrignoni/iLEAPP) |
| **aLEAPP** | MIT | [GitHub](https://github.com/abrignoni/ALEAPP) |
| **Android Platform Tools (ADB)** | Apache 2.0 | [Android Developers](https://developer.android.com/tools/releases/platform-tools) |
| **libimobiledevice** | LGPL-2.1+ | [GitHub](https://github.com/libimobiledevice/libimobiledevice) |
| **FastAPI / Pydantic** | MIT | [GitHub](https://github.com/tiangolo/fastapi) |
| **Electron** | MIT | [GitHub](https://github.com/electron/electron) |
| **React** | MIT | [GitHub](https://github.com/facebook/react) |
| **SimpleKML** | LGPL-3.0 | [GitHub](https://github.com/maphew/simplekml) |

---

## LGPL Compliance

Veritas Lab includes components licensed under the GNU Lesser General Public License (LGPL). As required by the LGPL, users have the right to modify these libraries and relink them with Veritas Lab.

### 1. libimobiledevice (LGPL-2.1)
This project uses pre-compiled binaries of libimobiledevice for device communication. 
- **Source Code**: [https://github.com/libimobiledevice/libimobiledevice](https://github.com/libimobiledevice/libimobiledevice)
- **Relinking**: Users can replace the provided binaries in the `bin/` directory with their own compiled versions.

### 2. SimpleKML (LGPL-3.0)
- **Source Code**: [https://github.com/maphew/simplekml](https://github.com/maphew/simplekml)

---

## MIT / BSD / Apache Components

The following libraries are included under permissive licenses (MIT, BSD, Zlib). Their respective copyright notices are preserved in the source code or associated metadata:

- **Data Processing**: Pandas, NumPy, Bencoding, Blackboxprotobuf
- **Serialization**: Protobuf, xmltodict, nska-deserialize, mdplistlib
- **Utilities**: Bytefield-svg, clsx, date-fns, lucide-react, react-router-dom
- **Specialized**: astc-decomp-faster (Zlib), pyliblzfse (MIT), fitdecode (MIT)

Detailed license texts are available at their respective source repositories linked above.
