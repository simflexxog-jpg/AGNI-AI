import pkgutil, importlib
import pipecat
print('pipecat', pipecat.__file__)
print('top-level', [m.name for m in pkgutil.iter_modules(pipecat.__path__)])

for mod_name in [
    'pipecat.services.fasterwhisper',
    'pipecat.services.fasterwhisper.stt',
    'pipecat.services.ollama',
    'pipecat.services.ollama.llm',
    'pipecat.services.kokoro',
    'pipecat.services.kokoro.tts',
    'pipecat.transports.base_transport',
    'pipecat.transports.network.webrtc_connection',
    'pipecat.transports.network.fastapi_websocket',
    'pipecat.transports.network.webrtc_transport',
    'pipecat.frames.frames',
    'pipecat.pipeline.pipeline',
    'pipecat.processors.aggregators.llm_response',
    'pipecat.processors.frameworks.rtvi',
    'pipecat.runner',
    'pipecat.runner.types',
    'pipecat.runner.run',
]:
    try:
        mod = importlib.import_module(mod_name)
        print('OK', mod_name, getattr(mod, '__file__', None))
    except Exception as exc:
        print('ERR', mod_name, repr(exc))
