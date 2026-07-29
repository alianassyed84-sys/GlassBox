"""
tracing.py — OpenTelemetry observability tracing for Glassbox agent calls.
"""
import logging
from contextlib import contextmanager
from typing import Any, Dict, Optional

logger = logging.getLogger("tracing")

_tracer = None

import os

try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    resource = Resource.create({"service.name": "glassbox-agent-pipeline"})
    provider = TracerProvider(resource=resource)
    
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    otlp_headers = os.getenv("OTEL_EXPORTER_OTLP_HEADERS")
    
    if otlp_endpoint and otlp_headers:
        # Honeycomb or other OTLP
        headers_dict = dict([h.split("=", 1) for h in otlp_headers.split(",") if "=" in h])
        exporter = OTLPSpanExporter(endpoint=otlp_endpoint, headers=headers_dict)
        logger.info(f"OpenTelemetry initialized with OTLPSpanExporter ({otlp_endpoint}).")
    else:
        exporter = ConsoleSpanExporter()
        logger.info("OpenTelemetry initialized with ConsoleSpanExporter (No OTLP config).")

    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer("glassbox.traced_call")
except Exception as exc:
    logger.warning(f"OpenTelemetry initialization warning ({exc}). Tracing will run in no-op fallback mode.")
    _tracer = None


@contextmanager
def trace_agent_span(
    agent_name: str,
    node_type: str,
    run_id: int,
    attributes: Optional[Dict[str, Any]] = None,
):
    """
    Context manager that wraps an agent call with an OpenTelemetry trace span.
    Exports span telemetry alongside custom Node table tracking.
    """
    if _tracer:
        span_name = f"glassbox.{agent_name}.{node_type}"
        with _tracer.start_as_current_span(span_name) as span:
            span.set_attribute("glassbox.run_id", run_id)
            span.set_attribute("glassbox.agent_name", agent_name)
            span.set_attribute("glassbox.node_type", node_type)
            if attributes:
                for k, v in attributes.items():
                    if isinstance(v, (str, int, float, bool)):
                        span.set_attribute(f"glassbox.{k}", v)
            yield span
    else:
        yield None
