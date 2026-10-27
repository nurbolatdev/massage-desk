package com.massagedesk.api.messaging;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WhatsAppWebhookController.class)
@TestPropertySource(properties = "app.whatsapp.verify-token=secret")
class WhatsAppWebhookControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void echoesTheChallengeForTheRightToken() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "secret")
                        .param("hub.challenge", "1158201444"))
                .andExpect(status().isOk())
                .andExpect(content().string("1158201444"));
    }

    @Test
    void rejectsAWrongToken() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "nope")
                        .param("hub.challenge", "42"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsAWrongModeOrMissingParameters() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "unsubscribe")
                        .param("hub.verify_token", "secret")
                        .param("hub.challenge", "42"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/webhook/whatsapp")).andExpect(status().isForbidden());
    }
}
