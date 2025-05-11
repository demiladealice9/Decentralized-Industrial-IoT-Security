;; Firmware Verification Contract
;; Validates software integrity

(define-data-var admin principal tx-sender)

;; Map to store firmware hashes
(define-map firmware-registry
  {
    device-type: (string-utf8 50),
    version: (string-utf8 20)
  }
  {
    hash: (buff 32),
    release-date: uint,
    is-current: bool
  }
)

;; Map to track device firmware status
(define-map device-firmware
  { device-id: (string-utf8 36) }
  {
    current-version: (string-utf8 20),
    current-hash: (buff 32),
    last-updated: uint
  }
)

;; Public function to register a new firmware version
(define-public (register-firmware (device-type (string-utf8 50)) (version (string-utf8 20)) (hash (buff 32)))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))

    ;; Set all existing firmware for this device type to not current
    (if (is-some (map-get? firmware-registry { device-type: device-type, version: version }))
        (begin
          (map-set firmware-registry
            { device-type: device-type, version: version }
            {
              hash: hash,
              release-date: block-height,
              is-current: true
            }
          )
          (ok true)
        )
        (begin
          (map-set firmware-registry
            { device-type: device-type, version: version }
            {
              hash: hash,
              release-date: block-height,
              is-current: true
            }
          )
          (ok true)
        )
    )
  )
)

;; Public function to update device firmware status
(define-public (update-device-firmware (device-id (string-utf8 36)) (device-type (string-utf8 50)) (version (string-utf8 20)) (hash (buff 32)))
  (begin
    ;; Verify the firmware hash matches the registered one
    (match (map-get? firmware-registry { device-type: device-type, version: version })
      firmware-data (begin
                      (asserts! (is-eq (get hash firmware-data) hash) (err u400))
                      (map-set device-firmware
                        { device-id: device-id }
                        {
                          current-version: version,
                          current-hash: hash,
                          last-updated: block-height
                        }
                      )
                      (ok true)
                    )
      (err u404)
    )
  )
)

;; Read-only function to verify firmware integrity
(define-read-only (verify-firmware (device-id (string-utf8 36)) (hash (buff 32)))
  (match (map-get? device-firmware { device-id: device-id })
    firmware-data (ok (is-eq (get current-hash firmware-data) hash))
    (err u404)
  )
)

;; Read-only function to check if firmware is current
(define-read-only (is-firmware-current (device-id (string-utf8 36)) (device-type (string-utf8 50)))
  (match (map-get? device-firmware { device-id: device-id })
    firmware-data (match (map-get? firmware-registry { device-type: device-type, version: (get current-version firmware-data) })
                    registry-data (ok (get is-current registry-data))
                    (err u404))
    (err u404)
  )
)

;; Function to transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u403))
    (var-set admin new-admin)
    (ok true)
  )
)
