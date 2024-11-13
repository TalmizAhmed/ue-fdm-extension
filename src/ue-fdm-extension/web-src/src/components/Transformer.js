
class FDMTransformer {
    constructor() {
        this.editorName = 'universal-editor'
        this.typeMapping = {
            integer: {
                resourceType: "core/fd/components/form/numberinput/v1/numberinput",
                fieldType: "number-input"
            },
            boolean: {
                resourceType: "core/fd/components/form/checkbox/v1/checkbox",
                fieldType: "checkbox"
            },
            text: {
                resourceType: "core/fd/components/form/textinput/v1/textinput",
                fieldType: "text-input"
            },
            string: {
                resourceType: "core/fd/components/form/textinput/v1/textinput",
                fieldType: "text-input"
            },
            object: {
                resourceType: "core/fd/components/form/panelcontainer/v1/panelcontainer",
                fieldType: "panel"
            }
        };
    }

    convertToDataRef = (datapath) => {
        if(!datapath) return '';
        return datapath.split('/').filter(Boolean).map((segment, index) => {
            return index === 0 ? `$` : `.${segment}`;
        }).join('');
    }

    getComponentTypeDetails = (type) => {
        return this.typeMapping[type] ? this.typeMapping[type] : this.typeMapping['text'];
    }

    createBaseComponentObject = ({ label, dataRef, fieldType, resourceType }) => ({
        name: label,
        xwalk: {
            page: {
                resourceType,
                template: {
                    "jcr:title": label,
                    fieldType,
                    enabled: true,
                    visible: true,
                    dataRef
                }
            }
        }
    });

    buildNestedComponentStructure = (component) => {
        const { label, children = [], fieldType, resourceType } = component;
        const componentObj = {
            [`${fieldType}`]: {
                "sling:resourceType": resourceType,
                fieldType,
                "jcr:title": label,
                enabled: true,
                visible: true
            }
        };
    
        children.forEach(child => {
            Object.assign(componentObj[fieldType], this.buildNestedComponentStructure(child));
        });
        
        return componentObj;
    };

    schemaToUEMapper = (fdmSchemaComponent) => {
        const mapProperties = (properties) => {
            if(!properties || properties.length === 0) {
                return []
            }
            return Object.keys(properties).map((modelName) => {
                const model = properties[modelName];
                return {
                    label: modelName,
                    fieldType: this.getComponentTypeDetails(model.type).fieldType,
                    resourceType: this.getComponentTypeDetails(model.type).resourceType, 
                    dataRef: this.convertToDataRef(model.datapath),
                    children: mapProperties(model.properties),
                };
            });
        };
        const rootItem = {
            label: fdmSchemaComponent.title || 'root',
            type: fdmSchemaComponent.type || 'panel',
            fieldType: this.getComponentTypeDetails(fdmSchemaComponent.type ? fdmSchemaComponent.type : 'object').fieldType,
            resourceType: this.getComponentTypeDetails(fdmSchemaComponent.type ? fdmSchemaComponent.type : 'object').resourceType, 
            dataRef: this.convertToDataRef(fdmSchemaComponent.datapath),
            children: mapProperties(fdmSchemaComponent.properties),
        };
        return rootItem;
      };


      transform = (fdmSchemaComponent) => {
        const items = this.schemaToUEMapper(fdmSchemaComponent)
        const baseObj = this.createBaseComponentObject(items);

        if (items.children && items.children.length) {
            items.children.forEach(child => {
                Object.assign(baseObj.xwalk.page.template, this.buildNestedComponentStructure(child));
            });
        }

        return baseObj;
    }

    /*
        Standard Pattern given by all implementations for:
        {
            id:,
            name:,
            properties: {},
            children: []
        }
        returns: { map(id -> actual Object), the standardized view format }
     */
    mapToView = (data) => {
        const map = {}
        const generateId = (title) => {
            const randomNum = Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
            return `${title.split(' ').join('')}${randomNum}`;
        };
        
        const mapProperties = (properties) => {
            if(!properties || properties.length === 0) {
                return []
            }
            return Object.keys(properties).map((key) => {
                const prop = properties[key];
                const id = generateId(prop.title)
                map[id] = prop
                return {
                    id,
                    name: prop.title,
                    properties: {
                        datapath: prop.datapath,
                        type: prop.type || 'panel'
                    },
                    children: prop.properties ? mapProperties(prop.properties) : []
                };
            });
        };
        
        const viewData = {
            id: generateId(data.title),
            name: data.title,
            properties: {
                datapath: data.datapath || null,
                type: data.type || null
            },
            children: data.properties ? mapProperties(data.properties) : []
        };
        return {map, viewData}
    }


}

const FormatRegistry = {
    universalEditor: {
        fdm: new FDMTransformer(),
        // Future => xdp: new XDPTransformer(),
    }
}


class UniversalEditor {
    constructor () {
        this.transformer = null;
        this.content = {}
        // For now:
        // this.setTransformer('fdm');
    }

    setTransformer(schemaType) {
        this.transformer = FormatRegistry.universalEditor[schemaType];
    }

    mapToView(data) {
        if(!this.transformer) {
            console.error("Transformer not set!")
        }
        this.content = this.transformer.mapToView(data);
        return this.content;
    }

    transform(data) {
        if(!this.transformer) {
            console.error("Transformer not set!")
        }
        return this.transformer.transform(data)
    }

    async fetchSchema ({formPath, instanceUrl, token, orgId}) {
        const formJsonResponse = await fetch(instanceUrl + formPath +".model.json", {
            method: "GET",
            headers: {"Authorization": token}
        });
        const formModel = await formJsonResponse.json();
        const schemaRef = null;
        
        if(formModel.properties) {
            const properties = formModel.properties;
            if(properties.schemaRef) {
                schemaRef = properties.schemaRef;
            }
        }
        if(!schemaRef) {
            console.error("No schema ref found with form")
            return;
        }
        const schema = await fetch(instanceUrl + "/adobe/forms/fm/v1/schema/fields?path=" + schemaRef , {
            method: "GET",
            headers: {
                "Authorization": token, 
                "X-Adobe-Accept-Unsupported-Api": 1, 
                "x-gw-ims-org-id": orgId
            }
        });
        return await schema.json();
    }

    async update({instanceUrl, formResource, data, token, callback}) {
        const details = {
            "connections": [
                {
                    "name": "aemconnection",
                    "protocol": "xwalk",
                    "uri": `${instanceUrl}`
                }
            ],
            "target": {
                "container": {
                    "resource": `${formResource}`,
                    "type": "container",
                    "prop": ""
                }
            },
            "content": this.transformer.transform(data)
        };
        console.log("Details object: ", details)
        let response;

        try {
        const res = await fetch("https://universal-editor-service.experiencecloud.live/add", {
            headers: {
              "authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(details),
            method: "POST"
          });
          response = await res.json();
        } catch(e) {
            console.error(e)
        }

        // Trigger event
        if(!response.error) {
            await callback(details, response)
        } else {
            console.error("Callback aborted due to failed request", response.error);
        }
    }

}
const ue = new UniversalEditor()
ue.setTransformer('fdm')
export {ue};