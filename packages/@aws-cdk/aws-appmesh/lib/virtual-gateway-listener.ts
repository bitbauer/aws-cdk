import * as cdk from '@aws-cdk/core';
import { CfnVirtualGateway } from './appmesh.generated';
import { validateHealthChecks } from './private/utils';
import { HealthCheck, Protocol } from './shared-interfaces';

/**
 * Represents the properties needed to define HTTP Listeners for a VirtualGateway
 */
export interface HttpGatewayListenerOptions {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port?: number

  /**
   * The health check information for the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;
}

/**
 * Represents the properties needed to define GRPC Listeners for a VirtualGateway
 */
export interface GrpcGatewayListenerOptions {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port?: number

  /**
   * The health check information for the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;
}

/**
 * Properties for a VirtualGateway listener
 */
export interface VirtualGatewayListenerConfig {
  /**
   * Single listener config for a VirtualGateway
   */
  readonly listener: CfnVirtualGateway.VirtualGatewayListenerProperty,
}

/**
 * Represents the properties needed to define listeners for a VirtualGateway
 */
export abstract class VirtualGatewayListener {
  /**
   * Returns an HTTP Listener for a VirtualGateway
   */
  public static http(options: HttpGatewayListenerOptions = {}): VirtualGatewayListener {
    return new HttpGatewayListener(options);
  }

  /**
   * Returns an HTTP2 Listener for a VirtualGateway
   */
  public static http2(options: HttpGatewayListenerOptions = {}): VirtualGatewayListener {
    return new Http2GatewayListener(options);
  }

  /**
   * Returns a GRPC Listener for a VirtualGateway
   */
  public static grpc(options: GrpcGatewayListenerOptions = {}): VirtualGatewayListener {
    return new GrpcGatewayListener(options);
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public abstract bind(scope: cdk.Construct): VirtualGatewayListenerConfig;
}

/**
 * Represents the properties needed to define an HTTP Listener for a VirtualGateway
 */
class HttpGatewayListener extends VirtualGatewayListener {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port: number;

  /**
   * Health checking strategy upstream nodes should use when communicating with the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * Protocol the listener implements
   */
  protected protocol: Protocol = Protocol.HTTP;

  constructor(options: HttpGatewayListenerOptions = {}) {
    super();
    this.port = options.port ? options.port : 8080;
    this.healthCheck = options.healthCheck;
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public bind(_scope: cdk.Construct): VirtualGatewayListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: this.protocol,
        },
        healthCheck: this.healthCheck ? renderHealthCheck(this.healthCheck, this.protocol, this.port): undefined,
      },
    };
  }
}

/**
* Represents the properties needed to define an HTTP2 Listener for a VirtualGateway
*/
class Http2GatewayListener extends HttpGatewayListener {
  constructor(options: HttpGatewayListenerOptions = {}) {
    super(options);
    this.protocol = Protocol.HTTP2;
  }
}

/**
 * Represents the properties needed to define a GRPC Listener for Virtual Gateway
 */
class GrpcGatewayListener extends VirtualGatewayListener {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port: number;

  /**
   * Health checking strategy upstream nodes should use when communicating with the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * Protocol the listener implements
   */
  protected protocol: Protocol = Protocol.GRPC;

  constructor(options: HttpGatewayListenerOptions = {}) {
    super();
    this.port = options.port ? options.port : 8080;
    this.healthCheck = options.healthCheck;
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public bind(_scope: cdk.Construct): VirtualGatewayListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: Protocol.GRPC,
        },
        healthCheck: this.healthCheck ? renderHealthCheck(this.healthCheck, this.protocol, this.port): undefined,
      },
    };
  }
}

function renderHealthCheck(
  hc: HealthCheck, listenerProtocol: Protocol, listenerPort: number): CfnVirtualGateway.VirtualGatewayHealthCheckPolicyProperty {

  if (hc.protocol === Protocol.TCP) {
    throw new Error('TCP health checks are not permitted for gateway listeners');
  }

  if (hc.protocol === Protocol.GRPC && hc.path) {
    throw new Error('The path property cannot be set with Protocol.GRPC');
  }

  const protocol = hc.protocol? hc.protocol : listenerProtocol;

  const healthCheck: CfnVirtualGateway.VirtualGatewayHealthCheckPolicyProperty = {
    healthyThreshold: hc.healthyThreshold || 2,
    intervalMillis: (hc.interval || cdk.Duration.seconds(5)).toMilliseconds(), // min
    path: hc.path || ((protocol === Protocol.HTTP || protocol === Protocol.HTTP2) ? '/' : undefined),
    port: hc.port || listenerPort,
    protocol: hc.protocol || listenerProtocol,
    timeoutMillis: (hc.timeout || cdk.Duration.seconds(2)).toMilliseconds(),
    unhealthyThreshold: hc.unhealthyThreshold || 2,
  };

  validateHealthChecks(healthCheck);

  return healthCheck;
}
