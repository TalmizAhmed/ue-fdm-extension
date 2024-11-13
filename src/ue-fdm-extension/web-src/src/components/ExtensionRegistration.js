/*
Copyright 2024 Adobe
All Rights Reserved.
NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/

import React, { useEffect } from 'react';
import { Text } from "@adobe/react-spectrum";
import { register } from "@adobe/uix-guest";
import { extensionId } from "./Constants";


function ExtensionRegistration() {
    useEffect(() => {
        const init = async () => {
            const registrationConfig = {
                id: extensionId,
                methods: {
                    rightPanel: {
                        addRails() {
                            return [
                                {
                                    id: "forms.datatree.panel",
                                    header: "Data Sources",
                                    url: '/#/fds',
                                    icon: 'FileData'
                                },
                            ];
                        },
                    },
                },
            };
            const guestConnection = await register(registrationConfig);
        }
        init().catch(console.error)
    }, []);

return <Text>IFrame for integration with Host...</Text>

}

export default ExtensionRegistration;
