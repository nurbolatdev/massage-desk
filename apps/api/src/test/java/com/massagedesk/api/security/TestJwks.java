package com.massagedesk.api.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Test double for the Supabase JWKS endpoint: serves a public key on loopback and signs tokens. */
final class TestJwks {

    private static final String KEY_ID = "test-key";

    private final ECKey key;
    private final HttpServer server;

    TestJwks() {
        try {
            key = generateKey();
            byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            server.createContext("/auth/v1/.well-known/jwks.json", exchange -> {
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
        } catch (IOException | JOSEException e) {
            throw new IllegalStateException("cannot start test JWKS server", e);
        }
    }

    String baseUrl() {
        return "http://" + server.getAddress().getHostString() + ":" + server.getAddress().getPort();
    }

    void stop() {
        server.stop(0);
    }

    /** Token as Supabase issues it, signed with the served key. */
    String token(UUID sub) {
        return token(sub, baseUrl() + "/auth/v1", List.of("authenticated"),
                Instant.now().plus(1, ChronoUnit.HOURS), key);
    }

    String token(UUID sub, String issuer, List<String> audience, Instant expiresAt) {
        return token(sub, issuer, audience, expiresAt, key);
    }

    private String token(UUID sub, String issuer, List<String> audience, Instant expiresAt, ECKey signingKey) {
        Instant issuedAt = expiresAt.isBefore(Instant.now())
                ? expiresAt.minus(1, ChronoUnit.HOURS) : Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .audience(audience)
                .subject(sub.toString())
                .claim("role", "authenticated")
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.ES256).keyId(KEY_ID).build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(signingKey)))
                .encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();
    }

    /** Token with the served key id, signed by a different private key. */
    String foreignKeyToken(UUID sub) {
        try {
            return token(sub, baseUrl() + "/auth/v1", List.of("authenticated"),
                    Instant.now().plus(1, ChronoUnit.HOURS), generateKey());
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ECKey generateKey() throws JOSEException {
        return new ECKeyGenerator(Curve.P_256).keyID(KEY_ID).generate();
    }
}
