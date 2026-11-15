"""
==============================================================================
MOTOR DE CÓMPUTO EN HUGGING FACE SPACES (ZeroGPU)
NASA Space Apps - Terrain & Solar Analysis Engine
Backend para recepción de pesos y coordenadas desde Render Static Site.
==============================================================================
"""

import os
import time
import json
import math
from typing import Dict, Any, Tuple

# ==============================================================================
# 1. PARCHE DE COMPATIBILIDAD HUGGING FACE / GRADIO
# Soluciona: ImportError: cannot import name 'HfFolder' from 'huggingface_hub'
# ==============================================================================
import huggingface_hub
if not hasattr(huggingface_hub, "HfFolder"):
    class MockHfFolder:
        path_token = ""
        @classmethod
        def get_token(cls):
            try:
                return huggingface_hub.get_token()
            except Exception:
                return None
        @classmethod
        def save_token(cls, token):
            pass
        @classmethod
        def delete_token(cls):
            pass
    huggingface_hub.HfFolder = MockHfFolder

# ==============================================================================
# 2. IMPORTACIONES OBLIGATORIAS PARA ZEROGPU
# En ZeroGPU, 'import spaces' debe estar al inicio y demo.launch() al final
# ==============================================================================
import spaces
import gradio as gr

# ==============================================================================
# 3. BASE DE DATOS DE ANÁLOGOS TERRESTRES (NASA Analog Sites)
# ==============================================================================
ANALOGOS_TERRESTRES = [
    {
        "nombre": "Desierto de Atacama, Chile (Región Hiperárida)",
        "lat": -24.50,
        "lon": -69.25,
        "cuerpo_ideal": "mars",
        "descripcion": "Hiperaridez extrema, alta irradiancia solar (GHI) y suelos ricos en percloratos similares al regolito marciano.",
        "perfil_base": {
            "pendiente_media": 0.35, "pendiente_p90": 0.45, "rugosidad": 0.40,
            "orientacion": 0.60, "relieve": 0.50, "valles_crestas": 0.30,
            "ghi": 0.95, "albedo": 0.85
        }
    },
    {
        "nombre": "Cráter Haughton, Isla Devon, Canadá",
        "lat": 75.38,
        "lon": -89.67,
        "cuerpo_ideal": "mars",
        "descripcion": "Estructura de impacto paleoclimática con permafrost, cañones secos y crestas crateriformes análogas a Marte septentrional.",
        "perfil_base": {
            "pendiente_media": 0.60, "pendiente_p90": 0.75, "rugosidad": 0.80,
            "orientacion": 0.40, "relieve": 0.70, "valles_crestas": 0.85,
            "ghi": 0.30, "albedo": 0.55
        }
    },
    {
        "nombre": "Campo Volcánico de Mauna Kea / Mauna Loa, Hawái",
        "lat": 19.82,
        "lon": -155.46,
        "cuerpo_ideal": "moon",
        "descripcion": "Basaltos tefríticos de alta rugosidad y escombros piroclásticos representativos de los mares lunares y tierras altas.",
        "perfil_base": {
            "pendiente_media": 0.55, "pendiente_p90": 0.70, "rugosidad": 0.88,
            "orientacion": 0.50, "relieve": 0.65, "valles_crestas": 0.60,
            "ghi": 0.75, "albedo": 0.30
        }
    },
    {
        "nombre": "Craters of the Moon, Idaho, EE.UU.",
        "lat": 43.46,
        "lon": -113.56,
        "cuerpo_ideal": "moon",
        "descripcion": "Extensa meseta basáltica con tubos de lava y conos de escoria, análogo clásico de exploración lunar de la NASA.",
        "perfil_base": {
            "pendiente_media": 0.45, "pendiente_p90": 0.60, "rugosidad": 0.82,
            "orientacion": 0.48, "relieve": 0.55, "valles_crestas": 0.50,
            "ghi": 0.68, "albedo": 0.35
        }
    },
    {
        "nombre": "Parque Nacional del Teide, Tenerife, España",
        "lat": 28.27,
        "lon": -16.64,
        "cuerpo_ideal": "mars",
        "descripcion": "Campos de lava obsidiánica, relieve escarpado y fuerte insolación utilizados en ensayos de rovers de ESA y NASA.",
        "perfil_base": {
            "pendiente_media": 0.65, "pendiente_p90": 0.80, "rugosidad": 0.75,
            "orientacion": 0.52, "relieve": 0.85, "valles_crestas": 0.70,
            "ghi": 0.88, "albedo": 0.60
        }
    }
]

VARIABLE_KEYS = [
    "pendiente_media",
    "pendiente_p90",
    "rugosidad",
    "orientacion",
    "relieve",
    "valles_crestas",
    "ghi",
    "albedo"
]

ALIAS_MAP = {
    "pendiente media": "pendiente_media",
    "pendiente p90": "pendiente_p90",
    "rugosidad": "rugosidad",
    "orientación": "orientacion",
    "orientacion": "orientacion",
    "relieve": "relieve",
    "valles y crestas": "valles_crestas",
    "valles_crestas": "valles_crestas",
    "ghi": "ghi",
    "albedo": "albedo"
}

def extraer_datos_entrada(raw_input: Any) -> Tuple[str, Dict[str, Any], Dict[str, float]]:
    payload = raw_input
    if isinstance(payload, list) and len(payload) > 0:
        payload = payload[0]

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    if not isinstance(payload, dict):
        payload = {}

    cuerpo = str(payload.get("cuerpo_celeste", "mars")).lower()
    coordenadas = payload.get("coordenadas", {"lat": None, "lon": None}) or {}

    variables_raw = payload.get("variables", payload)
    if not isinstance(variables_raw, dict):
        variables_raw = {}

    pesos: Dict[str, float] = {}
    for k, v in variables_raw.items():
        k_norm = ALIAS_MAP.get(k.strip().lower(), k.strip().lower().replace(" ", "_"))
        if k_norm in VARIABLE_KEYS:
            try:
                pesos[k_norm] = float(v)
            except (ValueError, TypeError):
                pesos[k_norm] = 0.50

    for k in VARIABLE_KEYS:
        if k not in pesos:
            pesos[k] = 0.50

    return cuerpo, coordenadas, pesos

def calcular_mejor_analogo(cuerpo: str, coords_origen: Dict[str, Any], pesos: Dict[str, float]) -> Dict[str, Any]:
    candidatos = [a for a in ANALOGOS_TERRESTRES if a["cuerpo_ideal"] == cuerpo]
    if not candidatos:
        candidatos = ANALOGOS_TERRESTRES

    mejor_analogo = None
    mejor_score = -1.0
    mejor_similitudes = {}

    suma_pesos = sum(pesos.values()) or 1.0

    for cand in candidatos:
        perfil = cand["perfil_base"]
        sims_cand = {}
        score_ponderado = 0.0

        for var_key in VARIABLE_KEYS:
            peso_var = pesos.get(var_key, 0.5)
            val_base = perfil.get(var_key, 0.5)
            diferencia = abs(peso_var - val_base)
            sim_pct = max(0.55, min(0.98, 1.0 - (diferencia * 0.45)))
            sims_cand[var_key] = round(sim_pct, 2)
            score_ponderado += sim_pct * peso_var

        score_global = score_ponderado / suma_pesos
        if score_global > mejor_score:
            mejor_score = score_global
            mejor_analogo = cand
            mejor_similitudes = sims_cand

    similitud_pct = round(mejor_score * 100)

    variables_ordenadas = sorted(pesos.items(), key=lambda x: x[1], reverse=True)
    top1_nombre = variables_ordenadas[0][0].replace('_', ' ').capitalize()
    top1_peso = round(variables_ordenadas[0][1] * 100)
    top2_nombre = variables_ordenadas[1][0].replace('_', ' ').capitalize()
    top2_peso = round(variables_ordenadas[1][1] * 100)

    motivo = (
        f"El algoritmo ha seleccionado <strong>{mejor_analogo['nombre']}</strong> "
        f"con una <strong>similitud global del {similitud_pct}%</strong> frente a {cuerpo.capitalize()}. "
        f"El criterio maximiza tus variables prioritarias: <strong>{top1_nombre}</strong> ({top1_peso}%) "
        f"y <strong>{top2_nombre}</strong> ({top2_peso}%). {mejor_analogo['descripcion']}"
    )

    return {
        "lat": mejor_analogo["lat"],
        "lon": mejor_analogo["lon"],
        "nombre_analogo": mejor_analogo["nombre"],
        "similitud_global": similitud_pct,
        "similitudes": mejor_similitudes,
        "motivo": motivo,
        "cuerpo_origen": cuerpo,
        "coordenadas_origen": coords_origen
    }

@spaces.GPU
def endpoint_procesar_variables(json_input: Any) -> Dict[str, Any]:
    inicio = time.perf_counter()

    cuerpo, coords_origen, pesos = extraer_datos_entrada(json_input)
    analisis = calcular_mejor_analogo(cuerpo, coords_origen, pesos)

    duracion_ms = round((time.perf_counter() - inicio) * 1000, 2)

    respuesta = {
        "success": True,
        "lat": analisis["lat"],
        "lon": analisis["lon"],
        "coordenadas": {
            "lat": analisis["lat"],
            "lon": analisis["lon"]
        },
        "nombre_analogo": analisis["nombre_analogo"],
        "similitud_global": analisis["similitud_global"],
        "similitudes": analisis["similitudes"],
        "motivo": analisis["motivo"],
        "durationMs": duracion_ms,
        "pesos_recibidos": pesos,
        "metadata": {
            "servidor": "Hugging Face Space (ZeroGPU Nvidia A10G)",
            "tiempo_computo_ms": duracion_ms
        }
    }

    return respuesta

ejemplo_json_default = {
    "cuerpo_celeste": "mars",
    "coordenadas": {"lat": -14.5, "lon": 175.4},
    "variables": {
        "pendiente_media": 0.50,
        "pendiente_p90": 0.50,
        "rugosidad": 0.50,
        "orientacion": 0.50,
        "relieve": 0.50,
        "valles_crestas": 0.50,
        "ghi": 0.50,
        "albedo": 0.50
    }
}

with gr.Blocks(title="NASA Space Apps - Terrain & Solar Analysis Engine") as demo:
    gr.Markdown("# 🛰️ NASA Space Apps - Motor de Cómputo Espacial (ZeroGPU)")
    gr.Markdown(
        "Backend para la recepción de vectores de variables del terreno y análisis de análogos terrestres. "
        "Escucha peticiones directas desde el **Static Site en Render**."
    )

    with gr.Row():
        with gr.Column():
            gr.Markdown("### 📥 Entrada de Datos (JSON)")
            input_json_box = gr.JSON(
                value=ejemplo_json_default,
                label="Payload JSON (cuerpo_celeste, coordenadas y variables)"
            )
            btn_ejecutar = gr.Button("🚀 Computar Análogo Terrestre", variant="primary")

        with gr.Column():
            gr.Markdown("### 📤 Respuesta estructurada para Render")
            output_json_box = gr.JSON(label="Resultado JSON")

    btn_ejecutar.click(
        fn=endpoint_procesar_variables,
        inputs=[input_json_box],
        outputs=[output_json_box],
        api_name="predict"
    )

    btn_ejecutar.click(
        fn=endpoint_procesar_variables,
        inputs=[input_json_box],
        outputs=[output_json_box],
        api_name="analizar_variables"
    )

if __name__ == "__main__":
    demo.launch()
