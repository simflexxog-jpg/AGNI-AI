import inspect
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.base_transport import TransportParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response import LLMUserResponseAggregator
from pipecat.frames.frames import Frame
from pipecat.processors.frame_processor import FrameProcessor

print('WhisperSTTService', inspect.signature(WhisperSTTService.__init__))
print('OllamaLLMService', inspect.signature(OLLamaLLMService.__init__))
print('KokoroTTSService', inspect.signature(KokoroTTSService.__init__))
print('SmallWebRTCTransport', inspect.signature(SmallWebRTCTransport.__init__))
print('TransportParams', TransportParams.model_fields.keys())
print('Pipeline', inspect.signature(Pipeline.__init__))
print('PipelineTask', inspect.signature(PipelineTask.__init__))
print('PipelineRunner', inspect.signature(PipelineRunner.__init__))
print('LLMContext', hasattr(LLMContext, '__init__'))
print('LLMUserResponseAggregator', inspect.signature(LLMUserResponseAggregator.__init__))
print('FrameProcessor', inspect.signature(FrameProcessor.__init__))
