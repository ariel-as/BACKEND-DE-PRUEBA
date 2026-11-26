-- El método de salida se deriva de controla_caducidad: con caducidad FEFO ('E'), sin caducidad FIFO ('F').
UPDATE producto SET prd_metodo_salida = CASE WHEN prd_controla_caducidad = 'S' THEN 'E' ELSE 'F' END;
