import asyncio
from loguru import logger

from pipecat.frames.frames import Frame, InputAudioRawFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport


class EchoFrameProcessor(FrameProcessor):
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame):
            logger.debug(f"audio input {len(frame.audio)} bytes")
        if isinstance(frame, TranscriptionFrame):
            logger.info(f"transcript: {frame.text}")
        await self.push_frame(frame, direction)


class SimpleVoiceBot:
    def __init__(self) -> None:
        self._worker = None

    async def run(self) -> None:
        transport = SmallWebRTCTransport(
            params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
            connection=None,
        )

        stt = WhisperSTTService(model="tiny")
        llm = OLLamaLLMService(model="llama3.2:1b")
        tts = KokoroTTSService(voice="af_heart")
        echo = EchoFrameProcessor()

        pipeline = Pipeline([
            transport.input(),
            stt,
            echo,
            llm,
            tts,
            transport.output(),
        ])

        worker = PipelineWorker(
            pipeline,
            params=PipelineParams(enable_metrics=False),
            name="voice-worker",
        )
        self._worker = worker

        await worker.run()


async def main() -> None:
    bot = SimpleVoiceBot()
    try:
        await bot.run()
    except KeyboardInterrupt:
        logger.info("Shutting down")


if __name__ == "__main__":
    asyncio.run(main())
