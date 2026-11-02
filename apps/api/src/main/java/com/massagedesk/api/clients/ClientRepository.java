package com.massagedesk.api.clients;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    Optional<Client> findByPhone(String phone);

    @Query(nativeQuery = true, value = """
            select c.* from clients c
            order by lower(c.name) asc nulls last, c.phone asc
            limit :limit offset :offset
            """)
    List<Client> list(@Param("limit") int limit, @Param("offset") int offset);

    @Query(nativeQuery = true, value = """
            select c.* from clients c
            where lower(c.name) like lower(:name) escape '\\'
               or c.phone like :phone
            order by lower(c.name) asc nulls last, c.phone asc
            limit :limit offset :offset
            """)
    List<Client> search(
            @Param("name") String name,
            @Param("phone") String phone,
            @Param("limit") int limit,
            @Param("offset") int offset);
}
