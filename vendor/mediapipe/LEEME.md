MediaPipe Tasks Vision 1.2.2 (Google AI Edge), licencia Apache-2.0.
Copiado desde el paquete npm `@mediapipe/tasks-vision` (solo vision_bundle.mjs y wasm/vision_wasm_internal.*).

Modificación (permitida por Apache-2.0): en `vision_bundle.mjs` se anuló el envío al endpoint `/v1/log` (telemetría hacia odml.pa.googleapis.com). Esa función quedó en no-op para que no salga ningún dato del dispositivo. El resto del detector no se alteró.

Modelo: `models/efficientdet_lite0.tflite` (EfficientDet-Lite0 int8, COCO), de
https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite
